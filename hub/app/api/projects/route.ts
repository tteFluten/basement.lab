import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** GET: list projects. Members see only projects they belong to; admins see all. */
export async function GET(request: NextRequest) {
  if (!hasSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = (session.user as { role?: string }).role === "admin";
  const supabase = getSupabase();

  const projectColumns = "id, name, client, thumbnail_url, links, start_date, end_date, created_at";

  if (isAdmin) {
    const { data, error } = await supabase
      .from("projects")
      .select(projectColumns)
      .order("name");
    if (error) {
      console.error("Supabase projects select:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    type ProjectRow = { id: string; links?: object };
    const projects = (data ?? []) as ProjectRow[];
    const ids = projects.map((p) => p.id);
    const { data: membersData } = await supabase
      .from("project_members")
      .select("project_id, user_id")
      .in("project_id", ids);
    const membersByProject = new Map<string, string[]>();
    for (const row of membersData ?? []) {
      const arr = membersByProject.get(row.project_id) ?? [];
      arr.push(row.user_id);
      membersByProject.set(row.project_id, arr);
    }
    const items = projects.map((p) => ({
      ...p,
      links: p.links ?? {},
      memberIds: membersByProject.get(p.id) ?? [],
    }));
    return NextResponse.json({ items });
  }

  const { data: memberRows, error: memberError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", session.user.id);
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }
  const projectIds = (memberRows ?? []).map((r) => r.project_id).filter(Boolean);
  if (projectIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const { data, error } = await supabase
    .from("projects")
    .select(projectColumns)
    .in("id", projectIds)
    .order("name");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  type ProjectRow = { id: string; links?: object };
  const projects = (data ?? []) as ProjectRow[];
  const { data: membersData } = await supabase
    .from("project_members")
    .select("project_id, user_id")
    .in("project_id", projectIds);
  const membersByProject = new Map<string, string[]>();
  for (const row of membersData ?? []) {
    const arr = membersByProject.get(row.project_id) ?? [];
    arr.push(row.user_id);
    membersByProject.set(row.project_id, arr);
  }
  const items = projects.map((p) => ({
    ...p,
    links: p.links ?? {},
    memberIds: membersByProject.get(p.id) ?? [],
  }));
  return NextResponse.json({ items });
}

/** POST: create project. Admin only. */
export async function POST(request: NextRequest) {
  if (!hasSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    name,
    client,
    thumbnail_url,
    links,
    start_date,
    end_date,
  } = body as {
    name?: string;
    client?: string;
    thumbnail_url?: string;
    links?: Record<string, unknown>;
    start_date?: string;
    end_date?: string;
  };
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const insert: Record<string, unknown> = {
    name: name.trim(),
    client: typeof client === "string" ? client.trim() || null : null,
    thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url.trim() || null : null,
    links: links && typeof links === "object" ? links : {},
    start_date: typeof start_date === "string" && start_date.trim() ? start_date.trim() : null,
    end_date: typeof end_date === "string" && end_date.trim() ? end_date.trim() : null,
  };

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("projects")
    .insert(insert)
    .select("id, name, client, thumbnail_url, links, start_date, end_date, created_at")
    .single();

  if (error) {
    console.error("Supabase projects insert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
