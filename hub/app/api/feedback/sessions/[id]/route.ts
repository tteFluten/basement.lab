import { NextRequest, NextResponse } from "next/server";
import { getSupabase, hasSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/** GET: session metadata + video URL. No auth required (shareable links). */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("feedback_sessions")
    .select("id, project_id, title, description, version, session_type, video_url, source_url, thumbnail_url, duration_s, created_at")
    .eq("id", params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    projectId: data.project_id,
    title: data.title,
    description: data.description ?? null,
    version: data.version ?? null,
    sessionType: (data.session_type ?? "video") as "video" | "image" | "url",
    videoUrl: data.video_url ?? null,
    sourceUrl: data.source_url ?? null,
    thumbnailUrl: data.thumbnail_url ?? null,
    durationS: data.duration_s ?? null,
    createdAt: new Date(data.created_at).getTime(),
  });
}

/** PATCH: update session title and/or description. Auth required, ownership via project. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const isAdmin = (session.user as { role?: string }).role === "admin";

  const { data: fbSession } = await supabase
    .from("feedback_sessions")
    .select("id, project_id")
    .eq("id", params.id)
    .single();

  if (!fbSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isAdmin) {
    const { data: project } = await supabase
      .from("feedback_projects")
      .select("owner_id")
      .eq("id", fbSession.project_id)
      .single();
    if (project?.owner_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await request.json() as { title?: string; description?: string; version?: string; thumbnailUrl?: string; sourceUrl?: string };
  const updates: Record<string, string | null> = {};
  if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
  if (typeof body.description === "string") updates.description = body.description.trim();
  if (typeof body.version === "string") updates.version = body.version.trim();
  if (typeof body.thumbnailUrl === "string") updates.thumbnail_url = body.thumbnailUrl;
  if (typeof body.sourceUrl === "string") updates.source_url = body.sourceUrl;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("feedback_sessions")
    .update(updates)
    .eq("id", params.id)
    .select("id, project_id, title, description, version, session_type, video_url, source_url, thumbnail_url, duration_s, created_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });

  return NextResponse.json({
    id: data.id,
    projectId: data.project_id,
    title: data.title,
    description: data.description ?? null,
    version: data.version ?? null,
    sessionType: (data.session_type ?? "video") as "video" | "image" | "url",
    videoUrl: data.video_url ?? null,
    sourceUrl: data.source_url ?? null,
    thumbnailUrl: data.thumbnail_url ?? null,
    durationS: data.duration_s ?? null,
    createdAt: new Date(data.created_at).getTime(),
  });
}

/** DELETE: remove session. Auth + ownership checked via project. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const isAdmin = (session.user as { role?: string }).role === "admin";

  const { data: fbSession } = await supabase
    .from("feedback_sessions")
    .select("id, project_id")
    .eq("id", params.id)
    .single();

  if (!fbSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isAdmin) {
    const { data: project } = await supabase
      .from("feedback_projects")
      .select("owner_id")
      .eq("id", fbSession.project_id)
      .single();
    if (project?.owner_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await supabase.from("feedback_sessions").delete().eq("id", params.id);
  return NextResponse.json({ ok: true });
}
