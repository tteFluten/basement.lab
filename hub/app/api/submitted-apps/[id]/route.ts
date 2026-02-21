import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/** GET: single submitted app by id */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!hasSupabase()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("submitted_apps")
    .select("id, user_id, title, description, deploy_link, edit_link, thumbnail_url, icon, version, tags, created_at")
    .eq("id", params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let submittedBy: string | null = null;
  if (data.user_id) {
    const { data: u } = await supabase.from("users").select("full_name, email").eq("id", data.user_id).single();
    if (u) submittedBy = u.full_name?.trim() || u.email || null;
  }

  return NextResponse.json({
    id: data.id,
    userId: data.user_id,
    title: data.title,
    description: data.description ?? "",
    deployLink: data.deploy_link,
    editLink: data.edit_link ?? null,
    thumbnailUrl: data.thumbnail_url ?? null,
    icon: data.icon ?? null,
    version: data.version ?? "1.0",
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: new Date(data.created_at).getTime(),
    submittedBy,
  });
}

/** PATCH: update submitted app fields. Admin only. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (!hasSupabase()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  try {
    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (typeof body.title === "string") updates.title = body.title.trim();
    if (typeof body.description === "string") updates.description = body.description.trim() || null;
    if (typeof body.deployLink === "string") updates.deploy_link = body.deployLink.trim();
    if (typeof body.editLink === "string") updates.edit_link = body.editLink.trim() || null;
    if (typeof body.version === "string") updates.version = body.version.trim() || "1.0";
    if (typeof body.icon === "string") updates.icon = body.icon.trim() || null;
    if (body.icon === null) updates.icon = null;
    if (Array.isArray(body.tags)) {
      updates.tags = body.tags.filter((t: unknown) => typeof t === "string" && t.trim()).map((t: string) => t.trim());
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from("submitted_apps").update(updates).eq("id", params.id);

    if (error) {
      console.error("PATCH /api/submitted-apps/[id]:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/submitted-apps/[id]:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

/** DELETE: remove submitted app. Admin only. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (!hasSupabase()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const supabase = getSupabase();
  const { error } = await supabase.from("submitted_apps").delete().eq("id", params.id);

  if (error) {
    console.error("DELETE /api/submitted-apps/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
