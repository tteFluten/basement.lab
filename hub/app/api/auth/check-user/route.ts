import { NextRequest, NextResponse } from "next/server";
import { getSupabase, hasSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasSupabase()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: row, error } = await supabase
      .from("users")
      .select("id, password_hash, status")
      .eq("email", email)
      .single();

    if (error || !row) {
      return NextResponse.json({ exists: false, needsPassword: false });
    }

    if (row.status === "suspended") {
      return NextResponse.json({ exists: true, needsPassword: false, suspended: true });
    }

    const hasPassword = !!row.password_hash;
    return NextResponse.json({ exists: true, needsPassword: !hasPassword });
  } catch (e) {
    console.error("POST /api/auth/check-user:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
