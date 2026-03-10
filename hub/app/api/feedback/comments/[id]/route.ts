import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { getDb, hasDb } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const ANON_COOKIE = "fb_anon";

async function checkOwnership(
  db: ReturnType<typeof getDb>,
  commentId: string,
  userId: string | null,
  isAdmin: boolean
): Promise<{ allowed: boolean; comment: Record<string, unknown> | null }> {
  const { data } = await db
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
  if (!hasDb()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  const db = getDb();
  const { allowed, comment } = await checkOwnership(db, params.id, userId, isAdmin);
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { text?: string; completed?: boolean; priority?: string };
  const text = body.text !== undefined ? (body.text ?? "").trim() : undefined;
  const completed = typeof body.completed === "boolean" ? body.completed : undefined;
  const priority = (body.priority === "high" || body.priority === "medium" || body.priority === "low") ? body.priority : undefined;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (text !== undefined) updates.text = text;
  if (completed !== undefined) updates.completed = completed;
  if (priority !== undefined) updates.priority = priority;

  const { data, error } = await db
    .from("feedback_comments")
    .update(updates)
    .eq("id", params.id)
    .select("id, text, updated_at, completed, priority")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });

  const res: { id: string; text?: string; updatedAt: number; completed?: boolean; priority?: "high" | "medium" | "low" } = {
    id: data.id,
    updatedAt: new Date(data.updated_at).getTime(),
  };
  if (data.text !== undefined) res.text = data.text;
  if ((data as { completed?: boolean }).completed !== undefined) res.completed = (data as { completed?: boolean }).completed;
  if ((data as { priority?: string }).priority !== undefined) res.priority = (data as { priority?: "high" | "medium" | "low" }).priority;
  return NextResponse.json(res);
}

/** DELETE: remove comment. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!hasDb()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  const db = getDb();
  const { allowed, comment } = await checkOwnership(db, params.id, userId, isAdmin);
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.from("feedback_comments").delete().eq("id", params.id);
  return NextResponse.json({ ok: true });
}
