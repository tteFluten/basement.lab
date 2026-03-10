import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getDb, hasDb } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** GET: list projects.
 *  Default: returns only projects the user is a member of.
 *  ?all=1:  returns ALL projects with an `isMember` boolean on each item.
 *  ?members=1: additionally embeds memberIds[] on each item (admin only).
 */
export async function GET(request: NextRequest) {
  try {
    if (!hasDb()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = (session.user as { role?: string }).role === "admin";
    const db = getDb();
    const projectColumns = "id, name, client, thumbnail_url, links, start_date, end_date, created_at";
    const wantAll = request.nextUrl.searchParams.get("all") === "1";
    const wantMembers = request.nextUrl.searchParams.get("members") === "1";

    // Fetch all projects (always needed for wantAll, or for admins)
    const { data: allProjects, error: allErr } = await db
      .from("projects")
      .select(projectColumns)
      .order("name");
    if (allErr) {
      console.error("projects select:", allErr);
      return NextResponse.json({ error: allErr.message }, { status: 500 });
    }
    type ProjectRow = { id: string; links?: object };
    const projects = (allProjects ?? []) as ProjectRow[];
    const allIds = projects.map((p) => p.id);

    // Fetch membership rows for the current user
    const { data: myMemberRows } = allIds.length > 0
      ? await db.from("project_members").select("project_id").eq("user_id", session.user.id)
      : { data: [] };
    const myProjectIds = new Set(
      (myMemberRows ?? []).map((r: any) => r.project_id).filter(Boolean)
    );

    // Optionally embed all memberIds per project (admin feature)
    let membersByProject = new Map<string, string[]>();
    if (wantMembers && isAdmin && allIds.length > 0) {
      const { data: membersData } = await db
        .from("project_members")
        .select("project_id, user_id")
        .in("project_id", allIds);
      for (const row of membersData ?? []) {
        if (!row?.project_id || !row?.user_id) continue;
        const arr = membersByProject.get(row.project_id) ?? [];
        arr.push(row.user_id);
        membersByProject.set(row.project_id, arr);
      }
    }

    if (wantAll) {
      // Return every project with isMember flag so the client can split them.
      // Admins are treated as members of all projects so the toolbar shows them all.
      const items = projects.map((p) => ({
        ...p,
        links: p.links ?? {},
        isMember: isAdmin ? true : myProjectIds.has(p.id),
        ...(wantMembers && isAdmin ? { memberIds: membersByProject.get(p.id) ?? [] } : {}),
      }));
      return NextResponse.json({ items });
    }

    // Default: only the user's own projects (admin sees all as "own")
    const filtered = isAdmin
      ? projects
      : projects.filter((p) => myProjectIds.has(p.id));

    const items = filtered.map((p) => ({
      ...p,
      links: p.links ?? {},
      isMember: true,
      ...(wantMembers && isAdmin ? { memberIds: membersByProject.get(p.id) ?? [] } : {}),
    }));
    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/projects:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST: create project. Admin only. */
export async function POST(request: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json(
      { error: "Database not configured" },
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

  const db = getDb();
  const { data, error } = await db
    .from("projects")
    .insert(insert)
    .select("id, name, client, thumbnail_url, links, start_date, end_date, created_at")
    .single();

  if (error) {
    console.error("projects insert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
