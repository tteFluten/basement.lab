import { NextRequest, NextResponse } from "next/server";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { uploadDataUrl, hasBlob, resolveBlobUrl } from "@/lib/blob";

export const runtime = "nodejs";

/** POST: save a generation (upload image to Blob, insert row in Supabase) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      dataUrl,
      appId,
      name,
      width,
      height,
      userId,
      projectId,
    } = body as {
      dataUrl: string;
      appId: string;
      name?: string;
      width?: number;
      height?: number;
      userId?: string;
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

    if (!hasSupabase()) {
      return NextResponse.json(
        { ok: true, saved: false, message: "Supabase not configured" }
      );
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
        user_id: userId ?? null,
        project_id: projectId ?? null,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("Supabase generations insert:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      saved: true,
      id: data.id,
      created_at: data.created_at,
      blob_url: blobUrl,
    });
  } catch (e) {
    console.error("POST /api/generations:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

/** GET: list generations (optional query: userId, projectId, limit) */
export async function GET(request: NextRequest) {
  if (!hasSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? undefined;
    const projectId = searchParams.get("projectId") ?? undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const supabase = getSupabase();
    let q = supabase
      .from("generations")
      .select("id, app_id, blob_url, width, height, name, created_at, user_id, project_id")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (userId) q = q.eq("user_id", userId);
    if (projectId) q = q.eq("project_id", projectId);

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
