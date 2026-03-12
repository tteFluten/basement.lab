import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, hasDb } from "@/lib/db";

export const runtime = "nodejs";

/** GET — return global memory (used internally by ai-chat route) */
export async function GET() {
  if (!hasDb()) return NextResponse.json({ content: "" });
  const db = getDb();
  const { data } = await db
    .from("patas_global_memory")
    .select("content")
    .eq("id", 1)
    .single();
  return NextResponse.json({ content: (data as { content?: string } | null)?.content ?? "" });
}

/** POST — admin only: append a fact to global memory */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!hasDb()) return NextResponse.json({ ok: false });

  const { append } = await req.json() as { append: string };
  if (!append?.trim()) return NextResponse.json({ ok: false });

  const db = getDb();
  const { data } = await db
    .from("patas_global_memory")
    .select("content")
    .eq("id", 1)
    .single();

  const current = (data as { content?: string } | null)?.content ?? "";
  const timestamp = new Date().toISOString().split("T")[0];
  const updated = current
    ? `${current}\n- [${timestamp}] ${append.trim()}`
    : `- [${timestamp}] ${append.trim()}`;

  await db
    .from("patas_global_memory")
    .update({ content: updated, updated_at: new Date().toISOString() })
    .eq("id", 1);

  return NextResponse.json({ ok: true, content: updated });
}
