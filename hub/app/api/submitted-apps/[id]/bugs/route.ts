import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** GET: list bug reports for a submitted app */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!hasSupabase()) return NextResponse.json({ items: [] });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bug_reports")
    .select("id, app_id, user_id, title, description, status, created_at")
    .eq("app_id", params.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = Array.from(new Set((data ?? []).map((r: { user_id: string | null }) => r.user_id).filter(Boolean) as string[]));
  const userMap: Map<string, string> = new Map();
  if (userIds.length > 0) {
    const { data: users } = await supabase.from("users").select("id, full_name, email").in("id", userIds);
    for (const u of users ?? []) userMap.set(u.id, u.full_name?.trim() || u.email || u.id);
  }

  const items = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id,
    appId: r.app_id,
    userId: r.user_id,
    title: r.title,
    description: r.description ?? "",
    status: r.status,
    createdAt: new Date(r.created_at as string).getTime(),
    reportedBy: r.user_id ? userMap.get(r.user_id as string) ?? null : null,
  }));

  return NextResponse.json({ items });
}

/** POST: create a bug report */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupabase()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : null;
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bug_reports")
    .insert({ app_id: params.id, user_id: session.user.id, title, description: description || null })
    .select("id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
