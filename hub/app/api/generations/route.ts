import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getDb, hasDb } from "@/lib/db";
import { uploadBuffer, hasR2 } from "@/lib/r2";
import { authOptions } from "@/lib/auth";
import { generateImageTags } from "@/lib/generateImageTags";

export const runtime = "nodejs";

/**
 * POST: save a generation. Two modes:
 *   Presigned (preferred): client already uploaded to R2 → body has { imageUrl, thumbUrl, thumbDataUrl? }
 *   Legacy fallback:       client sends base64     → body has { dataUrl, thumbDataUrl? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasDb()) {
      return NextResponse.json({ ok: true, saved: false, message: "Database not configured" });
    }
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      imageUrl,   // presigned path: already-uploaded R2 URL
      thumbUrl,   // presigned path: thumbnail R2 URL
      dataUrl,    // legacy path: base64 image
      thumbDataUrl, // used for AI tagging (small); also legacy upload target
      appId,
      name,
      width,
      height,
      projectId,
      prompt,
      isPublic,
    } = body as {
      imageUrl?: string;
      thumbUrl?: string;
      dataUrl?: string;
      thumbDataUrl?: string;
      appId: string;
      name?: string;
      width?: number;
      height?: number;
      projectId?: string;
      prompt?: string;
      isPublic?: boolean;
    };

    if (!appId) {
      return NextResponse.json({ error: "appId required" }, { status: 400 });
    }

    let finalImageUrl: string | null = imageUrl ?? null;
    let finalThumbUrl: string | null = thumbUrl ?? null;

    // Legacy path: client sent base64 → upload to R2 server-side
    if (!finalImageUrl) {
      if (!dataUrl) {
        return NextResponse.json({ error: "imageUrl or dataUrl required" }, { status: 400 });
      }
      if (!hasR2()) {
        return NextResponse.json({ error: "File storage (R2) not configured" }, { status: 503 });
      }
      const ts = Date.now();
      const toBuffer = (du: string): Buffer => {
        const b64 = du.includes(",") ? du.split(",")[1] : du;
        return Buffer.from(b64, "base64");
      };
      const [full, thumb] = await Promise.all([
        uploadBuffer(`generations/${appId}/${ts}.png`, toBuffer(dataUrl), "image/png"),
        thumbDataUrl
          ? uploadBuffer(`generations/${appId}/${ts}_thumb.jpg`, toBuffer(thumbDataUrl), "image/jpeg")
          : Promise.resolve(null),
      ]);
      finalImageUrl = full;
      finalThumbUrl = thumb;
    }

    const db = getDb();
    const row: Record<string, unknown> = {
      app_id: appId,
      image_url: finalImageUrl,
      width: width ?? null,
      height: height ?? null,
      name: name ?? null,
      user_id: session.user.id,
      project_id: projectId ?? null,
      is_public: Boolean(isPublic),
    };
    if (finalThumbUrl) row.thumb_url = finalThumbUrl;
    if (typeof prompt === "string" && prompt.trim()) row.prompt = prompt.trim();

    let { data, error } = await db
      .from("generations")
      .insert(row)
      .select("id, created_at")
      .single();

    if (error && finalThumbUrl && /thumb_url/i.test(error.message)) {
      delete row.thumb_url;
      const fb = await db.from("generations").insert(row).select("id, created_at").single();
      data = fb.data; error = fb.error;
    }
    if (error && /is_public|column/i.test(error.message)) {
      delete row.is_public;
      const fb = await db.from("generations").insert(row).select("id, created_at").single();
      data = fb.data; error = fb.error;
    }
    if (error && row.prompt !== undefined && /prompt|column/i.test(error.message)) {
      delete row.prompt;
      const fb = await db.from("generations").insert(row).select("id, created_at").single();
      data = fb.data; error = fb.error;
    }

    if (error || !data) {
      console.error("generations insert:", error);
      return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
    }

    // Use thumbnail for tagging (much smaller payload to Gemini)
    let tags: string[] = [];
    const tagSource = thumbDataUrl || dataUrl;
    if (tagSource) {
      try {
        tags = await generateImageTags(tagSource);
        if (tags.length > 0) {
          await db.from("generations").update({ tags }).eq("id", data.id);
        }
      } catch (tagErr) {
        console.warn("Tag generation skipped:", tagErr);
      }
    }

    return NextResponse.json({
      ok: true,
      saved: true,
      id: data.id,
      created_at: data.created_at,
      image_url: finalImageUrl,
      thumb_url: finalThumbUrl,
      tags,
    });
  } catch (e) {
    console.error("POST /api/generations:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

/** GET: list generations. Query: projectId, userId (admin), tag, appId, minWidth, maxWidth, minHeight, maxHeight, limit. Non-admins see only their own. */
export async function GET(request: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const userId = searchParams.get("userId") ?? undefined;
    const tag = searchParams.get("tag") ?? undefined;
    const appId = searchParams.get("appId") ?? undefined;
    const idsParam = searchParams.get("ids") ?? undefined;
    const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    const visibility = searchParams.get("visibility") ?? "all"; // "all" | "public" | "mine"
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 300);
    const light = searchParams.get("light") === "1";
    const isAdmin = (session.user as { role?: string }).role === "admin";

    const db = getDb();
    const selectWithTags = "id, app_id, image_url, thumb_url, width, height, name, created_at, user_id, project_id, tags, prompt, note, is_public";
    const selectWithoutTags = "id, app_id, image_url, thumb_url, width, height, name, created_at, user_id, project_id, prompt, note, is_public";

    const buildQuery = (selectColumns: string, includeTagFilter: boolean) => {
      let q = db
        .from("generations")
        .select(selectColumns)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (ids?.length) q = q.in("id", ids);
      if (visibility === "public") {
        q = q.eq("is_public", true);
      } else if (visibility === "mine") {
        q = q.eq("user_id", session.user.id);
      } else {
        if (!isAdmin) q = q.or(`user_id.eq.${session.user.id},is_public.eq.true`);
      }
      if (projectId) q = q.eq("project_id", projectId);
      if (userId && isAdmin) q = q.eq("user_id", userId);
      if (appId) q = q.eq("app_id", appId);
      if (includeTagFilter && tag) q = q.contains("tags", [tag]);
      return q;
    };

    let data: (Record<string, unknown> & { image_url: string; created_at: string })[] | null = null;
    let error: { message: string } | null = null;
    let hasTagsColumn = true;

    let result = await buildQuery(selectWithTags, true);
    data = result.data as typeof data;
    error = result.error;

    if (error && /does not exist|column.*(tags|thumb_url|prompt|note)/i.test(error.message)) {
      hasTagsColumn = false;
      const fallbackCols = "id, app_id, image_url, width, height, name, created_at, user_id, project_id";
      const fallback1 = await buildQuery(fallbackCols, false);
      data = fallback1.data as typeof data;
      error = fallback1.error;
    }
    if (error && /is_public/i.test(error.message)) {
      const colsNoPublic = "id, app_id, image_url, thumb_url, width, height, name, created_at, user_id, project_id, tags, prompt, note";
      let q = db.from("generations").select(colsNoPublic).order("created_at", { ascending: false }).limit(limit);
      if (ids?.length) q = q.in("id", ids);
      if (visibility === "mine") q = q.eq("user_id", session.user.id);
      else if (!isAdmin) q = q.eq("user_id", session.user.id);
      if (projectId) q = q.eq("project_id", projectId);
      if (userId && isAdmin) q = q.eq("user_id", userId);
      if (appId) q = q.eq("app_id", appId);
      if (tag) q = q.contains("tags", [tag]);
      const fallbackResult = await q;
      data = fallbackResult.data as typeof data;
      error = fallbackResult.error;
    }

    if (error) {
      console.error("generations select:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type GenRow = {
      id: string;
      app_id: string;
      image_url: string;
      thumb_url?: string | null;
      width: number;
      height: number;
      name: string;
      created_at: string;
      user_id: string;
      project_id: string | null;
      tags?: string[];
      prompt?: string | null;
      note?: string | null;
      is_public?: boolean;
    };
    const rows: GenRow[] = (data ?? []) as GenRow[];

    let userMap: Map<string, { fullName: string | null; avatarUrl: string | null }> = new Map();
    if (!light) {
      const userIds = Array.from(new Set((rows.map((r) => r.user_id).filter(Boolean) as string[])));
      if (userIds.length > 0) {
        const { data: userRows } = await db
          .from("users")
          .select("id, full_name, avatar_url")
          .in("id", userIds);
        for (const u of userRows ?? []) {
          userMap.set(u.id, {
            fullName: u.full_name ?? null,
            avatarUrl: u.avatar_url ?? null,
          });
        }
      }
    }

    const items = rows.map((row) => {
      const user = !light && row.user_id ? userMap.get(row.user_id) : undefined;
      const createdAt = row.created_at != null ? new Date(row.created_at).getTime() : Date.now();
      return {
        id: row.id,
        appId: row.app_id,
        dataUrl: null as string | null,
        imageUrl: row.image_url ?? null,
        thumbUrl: row.thumb_url ?? null,
        width: row.width ?? null,
        height: row.height ?? null,
        name: row.name ?? null,
        createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
        userId: row.user_id,
        projectId: row.project_id ?? null,
        tags: hasTagsColumn && Array.isArray(row.tags) ? row.tags : [],
        prompt: row.prompt ?? null,
        note: row.note ?? null,
        isPublic: Boolean(row.is_public),
        ...(user ? { user: { fullName: user.fullName, avatarUrl: user.avatarUrl } } : {}),
      };
    });

    const headers: HeadersInit = {};
    if (light) {
      headers["Cache-Control"] = "private, max-age=15, stale-while-revalidate=60";
    }

    return NextResponse.json({ items }, { headers });
  } catch (e) {
    console.error("GET /api/generations:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
