import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** POST: create a session. Body: { title, videoUrl, durationS? }. Auth required. */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const isAdmin = (session.user as { role?: string }).role === "admin";

  const { data: project } = await supabase
    .from("feedback_projects")
    .select("id, owner_id")
    .eq("slug", params.slug)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!isAdmin && project.owner_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as { title?: string; videoUrl?: string; durationS?: number };
  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const { data, error } = await supabase
    .from("feedback_sessions")
    .insert({
      project_id: project.id,
      title,
      video_url: body.videoUrl ?? null,
      duration_s: body.durationS ?? null,
      created_by: session.user.id,
    })
    .select("id, project_id, title, video_url, duration_s, created_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });

  return NextResponse.json({
    id: data.id,
    projectId: data.project_id,
    title: data.title,
    videoUrl: data.video_url ?? null,
    durationS: data.duration_s ?? null,
    createdAt: new Date(data.created_at).getTime(),
    commentCount: 0,
  });
}
