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
    .select("id, project_id, title, video_url, duration_s, created_at")
    .eq("id", params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    projectId: data.project_id,
    title: data.title,
    videoUrl: data.video_url ?? null,
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
