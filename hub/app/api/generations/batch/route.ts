import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * PATCH: batch update generations (projectId, tagsToAdd).
 * Body: { ids: string[], projectId?: string | null, tagsToAdd?: string[] }
 * User can edit own; admin can edit any. Returns { updated: number, errors: string[] }.
 */
export async function PATCH(request: NextRequest) {
  if (!hasSupabase()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map((x: unknown) => String(x)).filter(Boolean) : [];
  const projectId = body.projectId !== undefined ? (body.projectId || null) : undefined;
  const tagsToAdd = Array.isArray(body.tagsToAdd) ? body.tagsToAdd.map((t: unknown) => String(t).trim().toLowerCase()).filter(Boolean) : undefined;

  if (ids.length === 0) {
    return NextResponse.json({ error: "ids required (non-empty array)" }, { status: 400 });
  }
  if (projectId === undefined && !tagsToAdd?.length) {
    return NextResponse.json({ error: "Provide projectId and/or tagsToAdd" }, { status: 400 });
  }

  const isAdmin = (session.user as { role?: string }).role === "admin";
  const supabase = getSupabase();

  const { data: rows, error: fetchError } = await supabase
    .from("generations")
    .select("id, user_id, tags")
    .in("id", ids);

  if (fetchError) {
    console.error("batch fetch:", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const hasTagsColumn = rows?.every((r: { tags?: unknown }) => r && "tags" in r);
  const allowed = (rows ?? []).filter(
    (r: { user_id: string }) => isAdmin || r.user_id === session.user!.id
  );
  const errors: string[] = [];
  let updated = 0;

  for (const row of allowed) {
    const updates: Record<string, unknown> = {};
    if (projectId !== undefined) updates.project_id = projectId;
    if (tagsToAdd?.length && hasTagsColumn) {
      const current = Array.isArray((row as { tags?: string[] }).tags) ? (row as { tags: string[] }).tags : [];
      const merged = Array.from(new Set([...current.map((t) => t.toLowerCase()), ...tagsToAdd]));
      updates.tags = merged;
    } else if (tagsToAdd?.length && !hasTagsColumn) {
      updates.tags = tagsToAdd;
    }

    if (Object.keys(updates).length === 0) continue;

    const { error: updateError } = await supabase
      .from("generations")
      .update(updates)
      .eq("id", row.id);

    if (updateError) {
      errors.push(`${row.id}: ${updateError.message}`);
    } else {
      updated++;
    }
  }

  return NextResponse.json({ updated, errors: errors.length ? errors : undefined });
}

/**
 * DELETE: batch delete generations. User can delete own; admin can delete any.
 * Body: { ids: string[] }. Returns { deleted: number, errors: string[] }.
 */
export async function DELETE(request: NextRequest) {
  if (!hasSupabase()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map((x: unknown) => String(x)).filter(Boolean) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids required (non-empty array)" }, { status: 400 });
  }

  const isAdmin = (session.user as { role?: string }).role === "admin";
  const supabase = getSupabase();

  const { data: rows, error: fetchError } = await supabase
    .from("generations")
    .select("id, user_id")
    .in("id", ids);

  if (fetchError) {
    console.error("batch delete fetch:", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const allowed = (rows ?? []).filter(
    (r: { user_id: string }) => isAdmin || r.user_id === session.user!.id
  );
  const toDelete = allowed.map((r: { id: string }) => r.id);
  const errors: string[] = [];
  let deleted = 0;

  for (const id of toDelete) {
    const { error: deleteError } = await supabase.from("generations").delete().eq("id", id);
    if (deleteError) errors.push(`${id}: ${deleteError.message}`);
    else deleted++;
  }

  return NextResponse.json({ deleted, errors: errors.length ? errors : undefined });
}
