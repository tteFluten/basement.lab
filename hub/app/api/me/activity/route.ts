import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** GET: user's bug reports and ratings */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupabase()) return NextResponse.json({ bugs: [], ratings: [] });

  const supabase = getSupabase();

  const { data: bugs } = await supabase
    .from("bug_reports")
    .select("id, app_id, title, status, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: ratings } = await supabase
    .from("app_ratings")
    .select("id, app_id, score, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const appIds = Array.from(new Set([
    ...((bugs ?? []).map((b: { app_id: string }) => b.app_id)),
    ...((ratings ?? []).map((r: { app_id: string }) => r.app_id)),
  ].filter(Boolean)));

  const appMap: Map<string, string> = new Map();
  if (appIds.length > 0) {
    const { data: apps } = await supabase.from("submitted_apps").select("id, title").in("id", appIds);
    for (const a of apps ?? []) appMap.set(a.id, a.title);
  }

  return NextResponse.json({
    bugs: (bugs ?? []).map((b: Record<string, unknown>) => ({
      id: b.id,
      appId: b.app_id,
      appTitle: appMap.get(b.app_id as string) ?? "Unknown",
      title: b.title,
      status: b.status,
      createdAt: new Date(b.created_at as string).getTime(),
    })),
    ratings: (ratings ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      appId: r.app_id,
      appTitle: appMap.get(r.app_id as string) ?? "Unknown",
      score: r.score,
      createdAt: new Date(r.created_at as string).getTime(),
    })),
  });
}
