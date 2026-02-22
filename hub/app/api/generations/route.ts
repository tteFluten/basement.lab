import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { uploadDataUrl, hasBlob } from "@/lib/blob";
import { authOptions } from "@/lib/auth";
import { generateImageTags } from "@/lib/generateImageTags";

export const runtime = "nodejs";

/** POST: save a generation (upload image to Blob, insert row in Supabase). Requires session; user_id from session. */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasSupabase()) {
      const body = await request.json();
      const { dataUrl, appId } = body as { dataUrl?: string; appId?: string };
      if (!dataUrl || !appId) {
        return NextResponse.json(
          { error: "dataUrl and appId required" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { ok: true, saved: false, message: "Supabase not configured" }
      );
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      dataUrl,
      appId,
      name,
      width,
      height,
      projectId,
    } = body as {
      dataUrl: string;
      appId: string;
      name?: string;
      width?: number;
      height?: number;
      projectId?: string;
    };

    if (!dataUrl || !appId) {
      return NextResponse.json(
        { error: "dataUrl and appId required" },
        { status: 400 }
      );
    }

    let blobUrl: string | null = null;
    if (hasBlob()) {
      const pathname = `generations/${appId}/${Date.now()}.png`;
      blobUrl = await uploadDataUrl(dataUrl, pathname);
    }

    const storedUrl = blobUrl ?? dataUrl;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("generations")
      .insert({
        app_id: appId,
        blob_url: storedUrl,
        width: width ?? null,
        height: height ?? null,
        name: name ?? null,
        user_id: session.user.id,
        project_id: projectId ?? null,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("Supabase generations insert:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let tags: string[] = [];
    try {
      tags = await generateImageTags(dataUrl);
      if (tags.length > 0) {
        await supabase.from("generations").update({ tags }).eq("id", data.id);
      }
    } catch (tagErr) {
      console.warn("Tag generation skipped:", tagErr);
    }

    return NextResponse.json({
      ok: true,
      saved: true,
      id: data.id,
      created_at: data.created_at,
      blob_url: blobUrl,
      tags,
    });
  } catch (e) {
    console.error("POST /api/generations:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

/** GET: list generations. Query: projectId, userId (admin), tag, appId, minWidth, maxWidth, minHeight, maxHeight, limit. Non-admins see only their own. */
export async function GET(request: NextRequest) {
  if (!hasSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
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
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 200);
    const light = searchParams.get("light") === "1";
    const isAdmin = (session.user as { role?: string }).role === "admin";

    const supabase = getSupabase();
    const selectWithTags = "id, app_id, blob_url, width, height, name, created_at, user_id, project_id, tags";
    const selectWithoutTags = "id, app_id, blob_url, width, height, name, created_at, user_id, project_id";

    const buildQuery = (selectColumns: string, includeTagFilter: boolean) => {
      let q = supabase
        .from("generations")
        .select(selectColumns)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!isAdmin) q = q.eq("user_id", session.user.id);
      if (projectId) q = q.eq("project_id", projectId);
      if (userId && isAdmin) q = q.eq("user_id", userId);
      if (appId) q = q.eq("app_id", appId);
      if (includeTagFilter && tag) q = q.contains("tags", [tag]);
      return q;
    };

    let data: (Record<string, unknown> & { blob_url: string; created_at: string })[] | null = null;
    let error: { message: string } | null = null;
    let hasTagsColumn = true;

    let result = await buildQuery(selectWithTags, true);
    data = result.data as typeof data;
    error = result.error;

    if (error && /does not exist|column.*tags/i.test(error.message)) {
      hasTagsColumn = false;
      result = await buildQuery(selectWithoutTags, false);
      data = result.data as typeof data;
      error = result.error;
    }

    if (error) {
      console.error("Supabase generations select:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type GenRow = {
      id: string;
      app_id: string;
      blob_url: string;
      width: number;
      height: number;
      name: string;
      created_at: string;
      user_id: string;
      project_id: string | null;
      tags?: string[];
    };
    const rows: GenRow[] = (data ?? []) as GenRow[];

    let userMap: Map<string, { fullName: string | null; avatarUrl: string | null }> = new Map();
    if (!light) {
      const userIds = Array.from(new Set((rows.map((r) => r.user_id).filter(Boolean) as string[])));
      if (userIds.length > 0) {
        const { data: userRows } = await supabase
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
      return {
        id: row.id,
        appId: row.app_id,
        dataUrl: null as string | null,
        blobUrl: row.blob_url,
        width: row.width,
        height: row.height,
        name: row.name,
        createdAt: new Date(row.created_at).getTime(),
        userId: row.user_id,
        projectId: row.project_id,
        tags: hasTagsColumn && Array.isArray(row.tags) ? row.tags : [],
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
