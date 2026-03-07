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

/** GET: list feedback projects for the current user. */
export async function GET() {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const isAdmin = (session.user as { role?: string }).role === "admin";

  let q = supabase
    .from("feedback_projects")
    .select("id, slug, name, description, owner_id, created_at")
    .order("created_at", { ascending: false });

  if (!isAdmin) q = q.eq("owner_id", session.user.id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const projectIds = (data ?? []).map((p) => p.id);
  const ownerIds = Array.from(new Set((data ?? []).map((p) => p.owner_id).filter(Boolean) as string[]));

  // Fetch owner names, session counts, and latest session video per project in parallel
  const [sessionCountsRes, usersRes, thumbsRes] = await Promise.all([
    projectIds.length > 0
      ? supabase.from("feedback_sessions").select("project_id").in("project_id", projectIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length > 0
      ? supabase.from("users").select("id, full_name, email").in("id", ownerIds)
      : Promise.resolve({ data: [] }),
    projectIds.length > 0
      ? supabase.from("feedback_sessions")
          .select("project_id, video_url")
          .in("project_id", projectIds)
          .not("video_url", "is", null)
          .order("created_at", { ascending: false })
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

  const items = (data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description ?? null,
    ownerId: p.owner_id ?? null,
    ownerName: p.owner_id ? (userMap[p.owner_id] ?? null) : null,
    createdAt: new Date(p.created_at).getTime(),
    sessionCount: sessionCounts[p.id] ?? 0,
    thumbVideoUrl: thumbVideos[p.id] ?? null,
  }));

  return NextResponse.json({ items });
}

/** POST: create a feedback project. */
export async function POST(request: NextRequest) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { name?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const supabase = getSupabase();
  let slug = toSlug(name) || "project";

  // Ensure slug uniqueness
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

  const { data, error } = await supabase
    .from("feedback_projects")
    .insert({ name, slug, owner_id: session.user.id })
    .select("id, slug, name, owner_id, created_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });

  const ownerName = session.user.name || session.user.email || null;
  return NextResponse.json({
    id: data.id,
    slug: data.slug,
    name: data.name,
    ownerId: data.owner_id,
    ownerName,
    createdAt: new Date(data.created_at).getTime(),
    sessionCount: 0,
  });
}
