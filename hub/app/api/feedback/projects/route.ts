import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** GET: list all feedback projects with membership status for current user. */
export async function GET() {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const isAdmin = (session.user as { role?: string }).role === "admin";
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("feedback_projects")
    .select("id, slug, name, description, owner_id, linked_project_id, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const projectIds = (data ?? []).map((p) => p.id);
  const ownerIds = Array.from(new Set((data ?? []).map((p) => p.owner_id).filter(Boolean) as string[]));
  const linkedProjectIds = Array.from(new Set((data ?? []).map((p) => p.linked_project_id).filter(Boolean) as string[]));

  // Parallel: session counts, thumbnails, owner names, linked project names,
  //           user's work-project memberships, user's direct feedback memberships
  const [sessionCountsRes, thumbsRes, usersRes, linkedProjectsRes, workMembershipsRes, directMembershipsRes] =
    await Promise.all([
      projectIds.length > 0
        ? supabase.from("feedback_sessions").select("project_id").in("project_id", projectIds)
        : Promise.resolve({ data: [] }),
      projectIds.length > 0
        ? supabase.from("feedback_sessions")
            .select("project_id, video_url")
            .in("project_id", projectIds)
            .not("video_url", "is", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      ownerIds.length > 0
        ? supabase.from("users").select("id, full_name, email").in("id", ownerIds)
        : Promise.resolve({ data: [] }),
      linkedProjectIds.length > 0
        ? supabase.from("projects").select("id, name").in("id", linkedProjectIds)
        : Promise.resolve({ data: [] }),
      // Which work projects does this user belong to?
      supabase.from("project_members").select("project_id").eq("user_id", userId),
      // Which feedback projects has this user directly joined?
      projectIds.length > 0
        ? supabase.from("feedback_project_members")
            .select("feedback_project_id")
            .eq("user_id", userId)
            .in("feedback_project_id", projectIds)
        : Promise.resolve({ data: [] }),
    ]);

  const sessionCounts: Record<string, number> = {};
  for (const s of sessionCountsRes.data ?? []) {
    sessionCounts[s.project_id] = (sessionCounts[s.project_id] ?? 0) + 1;
  }

  const thumbVideos: Record<string, string> = {};
  for (const s of (thumbsRes.data ?? []) as { project_id: string; video_url: string }[]) {
    if (!thumbVideos[s.project_id]) thumbVideos[s.project_id] = s.video_url;
  }

  const userMap: Record<string, string> = {};
  for (const u of (usersRes.data ?? []) as { id: string; full_name?: string; email?: string }[]) {
    userMap[u.id] = u.full_name || u.email || "Unknown";
  }

  const linkedProjectMap: Record<string, string> = {};
  for (const p of (linkedProjectsRes.data ?? []) as { id: string; name: string }[]) {
    linkedProjectMap[p.id] = p.name;
  }

  // Set of work project IDs this user belongs to
  const userWorkProjects = new Set((workMembershipsRes.data ?? []).map((r: { project_id: string }) => r.project_id));
  // Set of feedback project IDs this user directly joined
  const userDirectJoins = new Set((directMembershipsRes.data ?? []).map((r: { feedback_project_id: string }) => r.feedback_project_id));

  const items = (data ?? []).map((p) => {
    const isMember =
      isAdmin ||
      p.owner_id === userId ||
      (p.linked_project_id !== null && userWorkProjects.has(p.linked_project_id)) ||
      userDirectJoins.has(p.id);

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description ?? null,
      ownerId: p.owner_id ?? null,
      ownerName: p.owner_id ? (userMap[p.owner_id] ?? null) : null,
      linkedProjectId: p.linked_project_id ?? null,
      linkedProjectName: p.linked_project_id ? (linkedProjectMap[p.linked_project_id] ?? null) : null,
      createdAt: new Date(p.created_at).getTime(),
      sessionCount: sessionCounts[p.id] ?? 0,
      thumbVideoUrl: thumbVideos[p.id] ?? null,
      isMember,
    };
  });

  return NextResponse.json({ items });
}

/** POST: create a feedback project. */
export async function POST(request: NextRequest) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { name?: string; linkedProjectId?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const supabase = getSupabase();
  let slug = toSlug(name) || "project";

  const { data: existing } = await supabase
    .from("feedback_projects")
    .select("slug")
    .like("slug", `${slug}%`);

  const usedSlugs = new Set((existing ?? []).map((r) => r.slug));
  if (usedSlugs.has(slug)) {
    let i = 2;
    while (usedSlugs.has(`${slug}-${i}`)) i++;
    slug = `${slug}-${i}`;
  }

  const insert: Record<string, unknown> = { name, slug, owner_id: session.user.id };
  if (body.linkedProjectId) insert.linked_project_id = body.linkedProjectId;

  const { data, error } = await supabase
    .from("feedback_projects")
    .insert(insert)
    .select("id, slug, name, description, owner_id, linked_project_id, created_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });

  let linkedProjectName: string | null = null;
  if (data.linked_project_id) {
    const { data: lp } = await supabase.from("projects").select("name").eq("id", data.linked_project_id).single();
    linkedProjectName = lp?.name ?? null;
  }

  const ownerName = session.user.name || session.user.email || null;
  return NextResponse.json({
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description ?? null,
    ownerId: data.owner_id,
    ownerName,
    linkedProjectId: data.linked_project_id ?? null,
    linkedProjectName,
    createdAt: new Date(data.created_at).getTime(),
    sessionCount: 0,
    thumbVideoUrl: null,
    isMember: true,
  });
}
