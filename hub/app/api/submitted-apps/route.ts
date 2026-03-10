import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getDb, hasDb } from "@/lib/db";
import { uploadBuffer, hasR2 } from "@/lib/r2";
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
  icon: string | null;
  version: string | null;
  tags: string[] | null;
  created_at: string;
  external?: boolean;
};

/** GET: list submitted apps. Sorted by title. Includes submitter name. */
export async function GET(request: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ items: [] });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get("tag") ?? undefined;
    const q = searchParams.get("q") ?? undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 200, 500);

    const db = getDb();
    const cols = "id, user_id, title, description, deploy_link, edit_link, thumbnail_url, icon, version, tags, created_at, external";
    let query = db
      .from("submitted_apps")
      .select(cols)
      .order("title", { ascending: true })
      .limit(limit);

    if (tag) query = query.contains("tags", [tag]);

    let { data: rows, error } = await query;

    if (error && /icon|external/i.test(error.message)) {
      const fallback = db
        .from("submitted_apps")
        .select("id, user_id, title, description, deploy_link, edit_link, thumbnail_url, version, tags, created_at")
        .order("title", { ascending: true })
        .limit(limit);
      const fb = await fallback;
      rows = (fb.data as typeof rows);
      error = fb.error;
    }

    if (error) {
      console.error("submitted_apps select:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let items = (rows ?? []) as SubmittedAppRow[];

    if (q) {
      const lower = q.toLowerCase();
      items = items.filter(
        (r) =>
          r.title.toLowerCase().includes(lower) ||
          (r.description ?? "").toLowerCase().includes(lower)
      );
    }

    const userIds = Array.from(new Set(items.map((r) => r.user_id).filter(Boolean) as string[]));
    const userMap: Map<string, string> = new Map();
    if (userIds.length > 0) {
      const { data: userRows } = await db
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
      icon: row.icon ?? null,
      version: row.version ?? "1.0",
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: new Date(row.created_at).getTime(),
      submittedBy: row.user_id ? userMap.get(row.user_id) ?? null : null,
      external: Boolean(row.external),
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

/** POST: add a submitted app. Requires session. Thumbnail uploaded to Blob. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDb()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const deployLink = typeof body.deployLink === "string" ? body.deployLink.trim() : "";
    const editLink = typeof body.editLink === "string" ? body.editLink.trim() || null : null;
    const version = typeof body.version === "string" ? body.version.trim() || "1.0" : "1.0";
    const icon = typeof body.icon === "string" ? body.icon.trim() || null : null;
    const external = Boolean(body.external);
    let tags: string[] = [];
    if (Array.isArray(body.tags)) {
      tags = body.tags.filter((t: unknown) => typeof t === "string" && t.trim()).map((t: string) => t.trim());
    }

    let thumbnailUrl: string | null = null;
    const thumbnailDataUrl = typeof body.thumbnailDataUrl === "string" ? body.thumbnailDataUrl : null;
    if (thumbnailDataUrl && hasR2()) {
      const b64 = thumbnailDataUrl.includes(",") ? thumbnailDataUrl.split(",")[1] : thumbnailDataUrl;
      const buffer = Buffer.from(b64, "base64");
      const key = `submitted-apps/${Date.now()}.png`;
      try {
        thumbnailUrl = await uploadBuffer(key, buffer, "image/png");
      } catch (e) {
        console.error("Submitted app thumbnail upload failed:", e);
      }
    }

    if (!title || !deployLink) {
      return NextResponse.json(
        { error: "title and deployLink are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const row: Record<string, unknown> = {
      user_id: session.user.id,
      title,
      description: description || null,
      deploy_link: deployLink,
      edit_link: editLink,
      thumbnail_url: thumbnailUrl,
      icon: icon,
      version: version || "1.0",
      tags: tags.length ? tags : [],
      external,
    };

    let { data, error } = await db
      .from("submitted_apps")
      .insert(row)
      .select("id, title, created_at")
      .single();

    if (error && /icon|external/i.test(error.message)) {
      delete row.icon;
      if ("external" in row) delete row.external;
      const fb = await db
        .from("submitted_apps")
        .insert(row)
        .select("id, title, created_at")
        .single();
      data = fb.data;
      error = fb.error;
    }

    if (error || !data) {
      console.error("submitted_apps insert:", error);
      return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
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
