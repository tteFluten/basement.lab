import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getDb, hasDb } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** GET: current user profile (from Supabase users if available). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDb()) {
    return NextResponse.json({
      id: session.user.id,
      email: session.user.email ?? "",
      fullName: session.user.name ?? null,
      nickname: null,
      avatarUrl: null,
      role: (session.user as { role?: string }).role ?? "member",
    });
  }

  const db = getDb();
  const { data, error } = await db
    .from("users")
    .select("id, email, full_name, nickname, avatar_url, role")
    .eq("id", session.user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({
      id: session.user.id,
      email: session.user.email ?? "",
      fullName: session.user.name ?? null,
      nickname: null,
      avatarUrl: null,
      role: (session.user as { role?: string }).role ?? "member",
    });
  }

  return NextResponse.json({
    id: data.id,
    email: data.email,
    fullName: data.full_name ?? null,
    nickname: data.nickname ?? null,
    avatarUrl: data.avatar_url ?? null,
    role: data.role ?? "member",
  });
}

/** PATCH: update current user profile. Email cannot be changed. */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: { full_name?: string; nickname?: string; avatar_url?: string } = {};
  if (typeof body.fullName === "string") updates.full_name = body.fullName.trim() || null;
  if (typeof body.nickname === "string") updates.nickname = body.nickname.trim() || null;
  if (typeof body.avatarUrl === "string") updates.avatar_url = body.avatarUrl.trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  if (!hasDb()) {
    return NextResponse.json({ error: "Profile persistence not configured" }, { status: 503 });
  }

  const db = getDb();
  const { data, error } = await db
    .from("users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", session.user.id)
    .select("id, email, full_name, nickname, avatar_url, role")
    .single();

  if (error) {
    console.error("users update:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    email: data.email,
    fullName: data.full_name ?? null,
    nickname: data.nickname ?? null,
    avatarUrl: data.avatar_url ?? null,
    role: data.role ?? "member",
  });
}
