import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, hasDb } from "@/lib/db";

export const runtime = "nodejs";

// POST — any authenticated user can add an inbox item (called by Patas action)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasDb()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  let body: { message: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { message } = body;
  if (!message?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const user = session.user as { name?: string; email?: string } | undefined;

  const db = getDb();
  const { error } = await db.from("patas_inbox").insert({
    message: message.trim(),
    user_email: user?.email ?? null,
    user_name: user?.name ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// GET — admin only, returns unresolved items
export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!hasDb()) return NextResponse.json({ items: [] });

  const db = getDb();
  const { data, error } = await db
    .from("patas_inbox")
    .select("id, message, user_email, user_name, created_at, resolved")
    .eq("resolved", false)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

// PATCH — admin marks item as resolved
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!hasDb()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  let body: { id: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const db = getDb();
  const { error } = await db.from("patas_inbox").update({ resolved: true }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
