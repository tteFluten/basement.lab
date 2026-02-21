import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

type SubmittedAppRow = {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  deploy_link: string;
  edit_link: string | null;
  thumbnail_url: string | null;
  version: string | null;
  tags: string[] | null;
  created_at: string;
};

/** GET: list submitted apps. Sorted by title. Includes submitter name. No auth required for read. */
export async function GET() {
  if (!hasSupabase()) {
    return NextResponse.json({ items: [] });
  }

  try {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from("submitted_apps")
      .select("id, user_id, title, description, deploy_link, edit_link, thumbnail_url, version, tags, created_at")
      .order("title", { ascending: true });

    if (error) {
      console.error("Supabase submitted_apps select:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = (rows ?? []) as SubmittedAppRow[];
    const userIds = Array.from(new Set(items.map((r) => r.user_id).filter(Boolean) as string[]));
    let userMap: Map<string, string> = new Map();
    if (userIds.length > 0) {
      const { data: userRows } = await supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", userIds);
      for (const u of userRows ?? []) {
        userMap.set(u.id, u.full_name?.trim() || u.email || u.id);
      }
    }

    const out = items.map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description ?? "",
      deployLink: row.deploy_link,
      editLink: row.edit_link ?? null,
      thumbnailUrl: row.thumbnail_url ?? null,
      version: row.version ?? "1.0",
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: new Date(row.created_at).getTime(),
      submittedBy: row.user_id ? userMap.get(row.user_id) ?? null : null,
    }));

    return NextResponse.json({ items: out });
  } catch (e) {
    console.error("GET /api/submitted-apps:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

/** POST: add a submitted app. Requires session. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabase()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const deployLink = typeof body.deployLink === "string" ? body.deployLink.trim() : "";
    const editLink = typeof body.editLink === "string" ? body.editLink.trim() || null : null;
    const thumbnailUrl = typeof body.thumbnailUrl === "string" ? body.thumbnailUrl.trim() || null : null;
    const version = typeof body.version === "string" ? body.version.trim() || "1.0" : "1.0";
    let tags: string[] = [];
    if (Array.isArray(body.tags)) {
      tags = body.tags.filter((t: unknown) => typeof t === "string" && t.trim()).map((t: string) => t.trim());
    }

    if (!title || !deployLink) {
      return NextResponse.json(
        { error: "title and deployLink are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("submitted_apps")
      .insert({
        user_id: session.user.id,
        title,
        description: description || null,
        deploy_link: deployLink,
        edit_link: editLink,
        thumbnail_url: thumbnailUrl,
        version: version || "1.0",
        tags: tags.length ? tags : [],
      })
      .select("id, title, created_at")
      .single();

    if (error) {
      console.error("Supabase submitted_apps insert:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id: data.id,
      title: data.title,
      createdAt: new Date(data.created_at).getTime(),
    });
  } catch (e) {
    console.error("POST /api/submitted-apps:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
