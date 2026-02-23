import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: admin-only usage stats (users, generations, apps, submitted apps, bugs, ratings). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!hasSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const supabase = getSupabase();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [
      usersCountRes,
      activeUsersRes,
      generationsCountRes,
      generationsLast7Res,
      generationsLast30Res,
      recentGensRes,
      submittedAppsRes,
      bugReportsRes,
      openBugsRes,
      ratingsRes,
    ] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("generations").select("id", { count: "exact", head: true }),
      supabase.from("generations").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabase.from("generations").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
      supabase.from("generations").select("app_id, user_id, created_at").order("created_at", { ascending: false }).limit(5000),
      supabase.from("submitted_apps").select("id, user_id, title, created_at"),
      supabase.from("bug_reports").select("id", { count: "exact", head: true }),
      supabase.from("bug_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("app_ratings").select("id", { count: "exact", head: true }),
    ]);

    const totalUsers = usersCountRes.count ?? 0;
    let activeUsers = totalUsers;
    if (!activeUsersRes.error) activeUsers = activeUsersRes.count ?? totalUsers;

    const totalGenerations = generationsCountRes.count ?? 0;
    const generationsLast7 = generationsLast7Res.count ?? 0;
    const generationsLast30 = generationsLast30Res.count ?? 0;

    const recentGens = (recentGensRes.data ?? []) as { app_id: string; user_id: string | null; created_at: string }[];
    const byApp: Record<string, number> = {};
    const byUser: Record<string, { count: number; lastAt: number }> = {};
    for (const g of recentGens) {
      byApp[g.app_id] = (byApp[g.app_id] ?? 0) + 1;
      if (g.user_id) {
        if (!byUser[g.user_id]) byUser[g.user_id] = { count: 0, lastAt: 0 };
        byUser[g.user_id].count++;
        const t = new Date(g.created_at).getTime();
        if (t > byUser[g.user_id].lastAt) byUser[g.user_id].lastAt = t;
      }
    }
    const appIds = Object.keys(byApp).sort((a, b) => (byApp[b] ?? 0) - (byApp[a] ?? 0));
    const generationsByApp = appIds.map((appId) => ({ appId, count: byApp[appId] ?? 0 }));

    const userIds = Object.keys(byUser);
    const userActivity = userIds
      .map((uid) => ({
        userId: uid,
        generationsCount: byUser[uid].count,
        lastActivityAt: byUser[uid].lastAt,
      }))
      .sort((a, b) => b.generationsCount - a.generationsCount)
      .slice(0, 30);
    const activityUserIds = userActivity.map((a) => a.userId);
    const usersForActivity =
      activityUserIds.length > 0
        ? await supabase.from("users").select("id, full_name, email").in("id", activityUserIds)
        : { data: [] };
    const userMap = new Map(
      ((usersForActivity.data ?? []) as { id: string; full_name: string | null; email: string }[]).map((u) => [
        u.id,
        { full_name: u.full_name, email: u.email },
      ])
    );
    const activityWithNames = userActivity.map((a) => ({
      ...a,
      fullName: userMap.get(a.userId)?.full_name ?? null,
      email: userMap.get(a.userId)?.email ?? "",
    }));

    const submittedApps = (submittedAppsRes.data ?? []) as { id: string; user_id: string | null; title: string; created_at: string }[];
    const submittedByUser: Record<string, number> = {};
    for (const a of submittedApps) {
      const uid = a.user_id ?? "anonymous";
      submittedByUser[uid] = (submittedByUser[uid] ?? 0) + 1;
    }
    const submittedByUserList = Object.entries(submittedByUser)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    const submitterIds = Array.from(new Set(submittedByUserList.map((s) => s.userId).filter((id) => id !== "anonymous")));
    const submittersRes = submitterIds.length
      ? await supabase.from("users").select("id, full_name, email").in("id", submitterIds)
      : { data: [] };
    const submittersMap = new Map(
      ((submittersRes.data ?? []) as { id: string; full_name: string | null; email: string }[]).map((u) => [u.id, { fullName: u.full_name, email: u.email }])
    );

    const totalBugs = bugReportsRes.count ?? 0;
    const openBugs = openBugsRes.count ?? 0;
    const totalRatings = ratingsRes.count ?? 0;

    const stats = {
      users: { total: totalUsers, active: activeUsers },
      generations: {
        total: totalGenerations,
        last7Days: generationsLast7,
        last30Days: generationsLast30,
        byApp: generationsByApp,
        sampleSize: recentGens.length,
      },
      userActivity: activityWithNames,
      submittedApps: {
        total: submittedApps.length,
        byUser: submittedByUserList.map((s) => ({
          userId: s.userId,
          count: s.count,
          fullName: s.userId === "anonymous" ? null : submittersMap.get(s.userId)?.fullName ?? null,
          email: s.userId === "anonymous" ? "" : submittersMap.get(s.userId)?.email ?? "",
        })),
      },
      bugReports: { total: totalBugs, open: openBugs },
      ratings: { total: totalRatings },
    };

    return NextResponse.json(stats);
  } catch (e) {
    console.error("GET /api/admin/usage:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
