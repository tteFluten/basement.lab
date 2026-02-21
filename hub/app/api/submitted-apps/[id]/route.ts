import { NextRequest, NextResponse } from "next/server";
import { getSupabase, hasSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/** GET: single submitted app by id */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!hasSupabase()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("submitted_apps")
    .select("id, user_id, title, description, deploy_link, edit_link, thumbnail_url, icon, version, tags, created_at")
    .eq("id", params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let submittedBy: string | null = null;
  if (data.user_id) {
    const { data: u } = await supabase.from("users").select("full_name, email").eq("id", data.user_id).single();
    if (u) submittedBy = u.full_name?.trim() || u.email || null;
  }

  return NextResponse.json({
    id: data.id,
    userId: data.user_id,
    title: data.title,
    description: data.description ?? "",
    deployLink: data.deploy_link,
    editLink: data.edit_link ?? null,
    thumbnailUrl: data.thumbnail_url ?? null,
    icon: data.icon ?? null,
    version: data.version ?? "1.0",
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: new Date(data.created_at).getTime(),
    submittedBy,
  });
}
