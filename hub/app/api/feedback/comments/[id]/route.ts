import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const ANON_COOKIE = "fb_anon";

async function checkOwnership(
  supabase: ReturnType<typeof getSupabase>,
  commentId: string,
  userId: string | null,
  isAdmin: boolean
): Promise<{ allowed: boolean; comment: Record<string, unknown> | null }> {
  const { data } = await supabase
    .from("feedback_comments")
    .select("id, author_id, anon_token")
    .eq("id", commentId)
    .single();

  if (!data) return { allowed: false, comment: null };
  if (isAdmin) return { allowed: true, comment: data };
  if (userId && data.author_id === userId) return { allowed: true, comment: data };

  // Check anon token
  const cookieStore = cookies();
  const anonToken = cookieStore.get(ANON_COOKIE)?.value;
  if (anonToken && data.anon_token === anonToken) return { allowed: true, comment: data };

  return { allowed: false, comment: data };
}

/** PATCH: edit comment text. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  const supabase = getSupabase();
  const { allowed, comment } = await checkOwnership(supabase, params.id, userId, isAdmin);
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { text?: string };
  const text = (body.text ?? "").trim();

  const { data, error } = await supabase
    .from("feedback_comments")
    .update({ text, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("id, text, updated_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });

  return NextResponse.json({ id: data.id, text: data.text, updatedAt: new Date(data.updated_at).getTime() });
}

/** DELETE: remove comment. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  const supabase = getSupabase();
  const { allowed, comment } = await checkOwnership(supabase, params.id, userId, isAdmin);
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabase.from("feedback_comments").delete().eq("id", params.id);
  return NextResponse.json({ ok: true });
}
