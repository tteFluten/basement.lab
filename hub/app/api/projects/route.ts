import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** GET: list projects. Members see only projects they belong to; admins see all. */
export async function GET(request: NextRequest) {
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

  const isAdmin = (session.user as { role?: string }).role === "admin";
  const supabase = getSupabase();

  if (isAdmin) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, client, start_date, end_date, created_at")
      .order("name");
    if (error) {
      console.error("Supabase projects select:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ items: data ?? [] });
  }

  const { data: memberRows, error: memberError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", session.user.id);
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }
  const projectIds = (memberRows ?? []).map((r) => r.project_id).filter(Boolean);
  if (projectIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, client, start_date, end_date, created_at")
    .in("id", projectIds)
    .order("name");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

/** POST: create project. Admin only. */
export async function POST(request: NextRequest) {
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
  if ((session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, client } = body as { name?: string; client?: string };
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("projects")
    .insert({ name: name.trim(), client: client?.trim() ?? null })
    .select("id, name, client, created_at")
    .single();

  if (error) {
    console.error("Supabase projects insert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
