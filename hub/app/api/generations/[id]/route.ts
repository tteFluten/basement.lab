import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH: update a generation (tags, project_id). User can edit own; admin can edit any. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasSupabase()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = (await params).id;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: row, error: fetchError } = await supabase
    .from("generations")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = (session.user as { role?: string }).role === "admin";
  if (!isAdmin && row.user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (Array.isArray(body.tags)) {
    updates.tags = body.tags.map((t: unknown) => String(t).trim()).filter(Boolean);
  }
  if (body.projectId !== undefined) {
    updates.project_id = body.projectId || null;
  }
  if (typeof body.name === "string") {
    updates.name = body.name.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("generations")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    console.error("PATCH generation:", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** DELETE: remove a generation. User can delete own; admin can delete any. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const id = (await params).id;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: row, error: fetchError } = await supabase
    .from("generations")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = (session.user as { role?: string }).role === "admin";
  if (!isAdmin && row.user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("generations")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("DELETE generation:", deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
