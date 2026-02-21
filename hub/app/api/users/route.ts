import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

/** GET: list users. Admin only. */
export async function GET() {
  if (!hasSupabase()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  let { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, nickname, avatar_url, role, status")
    .order("email");

  if (error && /status/i.test(error.message)) {
    const fb = await supabase
      .from("users")
      .select("id, email, full_name, nickname, avatar_url, role")
      .order("email");
    data = fb.data as typeof data;
    error = fb.error;
  }

  if (error) {
    console.error("Supabase users select:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

/** POST: admin creates a new user. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!hasSupabase()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const full_name = typeof body.full_name === "string" ? body.full_name.trim() || null : null;
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() || null : null;
  const role = typeof body.role === "string" && ["admin", "member"].includes(body.role) ? body.role : "member";

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  if (!password || password.length < 4) {
    return NextResponse.json({ error: "password is required (min 4 chars)" }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .insert({ email, password_hash, full_name, nickname, role })
    .select("id, email, full_name, nickname, avatar_url, role")
    .single();

  if (error) {
    if (error.message?.includes("duplicate")) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }
    console.error("Supabase users insert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user: data });
}
