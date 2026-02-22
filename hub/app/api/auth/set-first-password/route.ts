import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase, hasSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasSupabase()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "email and password required" }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
    }

    const supabase = getSupabase();
    let { data: row, error: fetchErr } = await supabase
      .from("users")
      .select("id, password_hash, status")
      .eq("email", email)
      .single();

    if (fetchErr && /status/i.test(fetchErr.message)) {
      const fb = await supabase
        .from("users")
        .select("id, password_hash")
        .eq("email", email)
        .single();
      row = fb.data as typeof row;
      fetchErr = fb.error;
    }

    if (fetchErr || !row) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if ((row as Record<string, unknown>).status === "suspended") {
      return NextResponse.json({ error: "Account is suspended" }, { status: 403 });
    }

    if (row.password_hash) {
      return NextResponse.json({ error: "Password already set. Use login instead." }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const { error: updateErr } = await supabase
      .from("users")
      .update({ password_hash: hash, updated_at: new Date().toISOString() })
      .eq("id", row.id);

    if (updateErr) {
      console.error("set-first-password update:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/auth/set-first-password:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
