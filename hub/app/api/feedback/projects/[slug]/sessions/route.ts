import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getDb, hasDb } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** POST: create a session. Body: { title, videoUrl, durationS? }. Auth required. */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  if (!hasDb()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const isAdmin = (session.user as { role?: string }).role === "admin";

  const { data: project } = await db
    .from("feedback_projects")
    .select("id, owner_id")
    .eq("slug", params.slug)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!isAdmin && project.owner_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as { title?: string; sessionType?: string; videoUrl?: string; sourceUrl?: string; thumbnailUrl?: string; durationS?: number; version?: string };
  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const { data, error } = await db
    .from("feedback_sessions")
    .insert({
      project_id: project.id,
      title,
      session_type: body.sessionType ?? "video",
      video_url: body.videoUrl ?? null,
      source_url: body.sourceUrl ?? null,
      thumbnail_url: body.thumbnailUrl ?? null,
      duration_s: body.durationS ?? null,
      version: body.version?.trim() || null,
      created_by: session.user.id,
    })
    .select("id, project_id, title, description, version, session_type, video_url, source_url, thumbnail_url, duration_s, created_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });

  const st = data.session_type ?? "video";
  return NextResponse.json({
    id: data.id,
    projectId: data.project_id,
    title: data.title,
    description: data.description ?? null,
    version: data.version ?? null,
    sessionType: (st === "url" ? "review" : st) as "video" | "image" | "review",
    videoUrl: data.video_url ?? null,
    sourceUrl: data.source_url ?? null,
    thumbnailUrl: data.thumbnail_url ?? null,
    durationS: data.duration_s ?? null,
    createdAt: new Date(data.created_at).getTime(),
    commentCount: 0,
  });
}
