import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getDb, hasDb } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** POST: join a project (current user adds themselves as member). */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasDb()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = (await params).id;
  if (!projectId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = getDb();

  // Verify project exists
  const { data: project, error: fetchErr } = await db
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();
  if (fetchErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Upsert membership (idempotent)
  const { error } = await db
    .from("project_members")
    .upsert({ project_id: projectId, user_id: session.user.id }, { onConflict: "project_id,user_id" });
  if (error) {
    console.error("join project:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** DELETE: leave a project (current user removes themselves). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasDb()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = (await params).id;
  if (!projectId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = getDb();
  const { error } = await db
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", session.user.id);

  if (error) {
    console.error("leave project:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
