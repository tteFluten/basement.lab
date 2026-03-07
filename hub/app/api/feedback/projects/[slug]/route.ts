import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** GET: project details + sessions list. Auth required. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const isAdmin = (session.user as { role?: string }).role === "admin";

  const { data: project, error: pErr } = await supabase
    .from("feedback_projects")
    .select("id, slug, name, description, owner_id, created_at")
    .eq("slug", params.slug)
    .single();

  if (pErr || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!isAdmin && project.owner_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: sessions } = await supabase
    .from("feedback_sessions")
    .select("id, project_id, title, description, video_url, duration_s, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  // Comment counts per session
  const sessionIds = (sessions ?? []).map((s) => s.id);
  let commentCounts: Record<string, number> = {};
  if (sessionIds.length > 0) {
    const { data: comments } = await supabase
      .from("feedback_comments")
      .select("session_id")
      .in("session_id", sessionIds);
    for (const c of comments ?? []) {
      commentCounts[c.session_id] = (commentCounts[c.session_id] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description ?? null,
      ownerId: project.owner_id ?? null,
      createdAt: new Date(project.created_at).getTime(),
    },
    sessions: (sessions ?? []).map((s) => ({
      id: s.id,
      projectId: s.project_id,
      title: s.title,
      description: s.description ?? null,
      videoUrl: s.video_url ?? null,
      durationS: s.duration_s ?? null,
      createdAt: new Date(s.created_at).getTime(),
      commentCount: commentCounts[s.id] ?? 0,
    })),
  });
}

/** PATCH: update project name and/or description (owner or admin only). */
export async function PATCH(
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

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && project.owner_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as { name?: string; description?: string };
  const updates: Record<string, string> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("feedback_projects")
    .update(updates)
    .eq("id", project.id)
    .select("id, slug, name, description, owner_id, created_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });

  return NextResponse.json({
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description ?? null,
    ownerId: data.owner_id ?? null,
    createdAt: new Date(data.created_at).getTime(),
  });
}

/** DELETE: remove project (owner or admin only). */
export async function DELETE(
  _request: NextRequest,
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

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && project.owner_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await supabase.from("feedback_projects").delete().eq("id", project.id);
  return NextResponse.json({ ok: true });
}
