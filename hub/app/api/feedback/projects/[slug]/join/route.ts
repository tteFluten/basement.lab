import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** POST: self-join a feedback project. */
export async function POST(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const { data: project } = await supabase
    .from("feedback_projects")
    .select("id")
    .eq("slug", params.slug)
    .single();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await supabase
    .from("feedback_project_members")
    .upsert({ feedback_project_id: project.id, user_id: session.user.id }, { onConflict: "feedback_project_id,user_id" });

  return NextResponse.json({ ok: true });
}

/** DELETE: leave a feedback project. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const { data: project } = await supabase
    .from("feedback_projects")
    .select("id")
    .eq("slug", params.slug)
    .single();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await supabase
    .from("feedback_project_members")
    .delete()
    .eq("feedback_project_id", project.id)
    .eq("user_id", session.user.id);

  return NextResponse.json({ ok: true });
}
