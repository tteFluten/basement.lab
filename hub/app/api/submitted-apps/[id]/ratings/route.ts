import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** GET: average rating + user's own rating for a submitted app */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!hasSupabase()) return NextResponse.json({ average: 0, count: 0, userScore: null });

  const session = await getServerSession(authOptions);
  const supabase = getSupabase();

  const { data: ratings } = await supabase
    .from("app_ratings")
    .select("score, user_id")
    .eq("app_id", params.id);

  const scores = (ratings ?? []).map((r: { score: number }) => r.score);
  const average = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;

  let userScore: number | null = null;
  if (session?.user?.id) {
    const own = (ratings ?? []).find((r: { user_id: string }) => r.user_id === session.user!.id);
    if (own) userScore = (own as { score: number }).score;
  }

  return NextResponse.json({ average: Math.round(average * 10) / 10, count: scores.length, userScore });
}

/** POST: upsert rating (1-5) */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupabase()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const score = Number(body.score);
  if (!score || score < 1 || score > 5) return NextResponse.json({ error: "score must be 1-5" }, { status: 400 });

  const supabase = getSupabase();
  const { error } = await supabase
    .from("app_ratings")
    .upsert(
      { app_id: params.id, user_id: session.user.id, score },
      { onConflict: "app_id,user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, score });
}
