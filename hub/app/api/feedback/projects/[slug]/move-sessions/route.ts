import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getDb, hasDb } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** POST: move all sessions from this project to another project. Admin only. */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  if (!hasDb()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = (session.user as { role?: string }).role === "admin";
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { targetSlug } = body as { targetSlug?: string };
  if (!targetSlug) return NextResponse.json({ error: "targetSlug required" }, { status: 400 });

  const db = getDb();

  const { data: source } = await db
    .from("feedback_projects")
    .select("id, name")
    .eq("slug", params.slug)
    .single();
  if (!source) return NextResponse.json({ error: "Source project not found" }, { status: 404 });

  const { data: target } = await db
    .from("feedback_projects")
    .select("id, name")
    .eq("slug", targetSlug)
    .single();
  if (!target) return NextResponse.json({ error: "Target project not found" }, { status: 404 });

  const { count, error } = await db
    .from("feedback_sessions")
    .update({ project_id: target.id })
    .eq("project_id", source.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ moved: count ?? 0, from: source.name, to: target.name });
}
