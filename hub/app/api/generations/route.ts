import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { uploadDataUrl, hasBlob, resolveBlobUrl } from "@/lib/blob";
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
    const minWidth = searchParams.get("minWidth");
    const maxWidth = searchParams.get("maxWidth");
    const minHeight = searchParams.get("minHeight");
    const maxHeight = searchParams.get("maxHeight");
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const isAdmin = (session.user as { role?: string }).role === "admin";

    const supabase = getSupabase();
    let q = supabase
      .from("generations")
      .select("id, app_id, blob_url, width, height, name, created_at, user_id, project_id, tags")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!isAdmin) {
      q = q.eq("user_id", session.user.id);
    }
    if (projectId) q = q.eq("project_id", projectId);
    if (userId && isAdmin) q = q.eq("user_id", userId);
    if (appId) q = q.eq("app_id", appId);
    if (tag) q = q.contains("tags", [tag]);
    if (minWidth !== null && minWidth !== undefined && minWidth !== "") {
      q = q.gte("width", Number(minWidth));
    }
    if (maxWidth !== null && maxWidth !== undefined && maxWidth !== "") {
      q = q.lte("width", Number(maxWidth));
    }
    if (minHeight !== null && minHeight !== undefined && minHeight !== "") {
      q = q.gte("height", Number(minHeight));
    }
    if (maxHeight !== null && maxHeight !== undefined && maxHeight !== "") {
      q = q.lte("height", Number(maxHeight));
    }

    const { data, error } = await q;

    if (error) {
      console.error("Supabase generations select:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = await Promise.all(
      (data ?? []).map(async (row) => {
        const resolvedUrl = await resolveBlobUrl(row.blob_url);
        return {
          id: row.id,
          appId: row.app_id,
          dataUrl: resolvedUrl,
          blobUrl: row.blob_url,
          width: row.width,
          height: row.height,
          name: row.name,
          createdAt: new Date(row.created_at).getTime(),
          userId: row.user_id,
          projectId: row.project_id,
          tags: Array.isArray(row.tags) ? row.tags : [],
        };
      })
    );

    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/generations:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
