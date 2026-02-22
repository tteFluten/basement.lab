import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH: admin updates a user's data */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!hasSupabase()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (typeof body.full_name === "string") updates.full_name = body.full_name.trim() || null;
  if (typeof body.nickname === "string") updates.nickname = body.nickname.trim() || null;
  if (typeof body.role === "string" && ["admin", "member"].includes(body.role)) updates.role = body.role;
  if (typeof body.avatar_url === "string") updates.avatar_url = body.avatar_url.trim() || null;
  if (body.avatar_url === null) updates.avatar_url = null;
  if (typeof body.status === "string" && ["active", "suspended"].includes(body.status)) updates.status = body.status;
  if (typeof body.password === "string" && body.password.length >= 4) {
    updates.password_hash = await bcrypt.hash(body.password, 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", params.id)
    .select("id, email, full_name, nickname, avatar_url, role, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE: admin deletes a user */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!hasSupabase()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  if (params.id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("users").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
