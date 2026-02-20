import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** GET: list members of a project. Admin only. */
export async function GET(
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
  if (!session?.user?.id || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectId = (await params).id;
  if (!projectId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const userIds = (data ?? []).map((r) => r.user_id);
  return NextResponse.json({ userIds });
}

/** POST: set project members (replace). Body: { userIds: string[] }. Admin only. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectId = (await params).id;
  if (!projectId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const userIds = Array.isArray(body.userIds) ? body.userIds.filter((u: unknown) => typeof u === "string") : [];

  const supabase = getSupabase();
  await supabase.from("project_members").delete().eq("project_id", projectId);
  if (userIds.length > 0) {
    const { error } = await supabase.from("project_members").insert(
      userIds.map((user_id: string) => ({ project_id: projectId, user_id }))
    );
    if (error) {
      console.error("Supabase project_members insert:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
