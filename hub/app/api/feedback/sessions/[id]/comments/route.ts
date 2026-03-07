import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const ANON_COOKIE = "fb_anon";

function getOrCreateAnonToken(response?: NextResponse): string {
  const cookieStore = cookies();
  const existing = cookieStore.get(ANON_COOKIE)?.value;
  if (existing) return existing;
  return crypto.randomUUID();
}

/** GET: list comments for a session. No auth required. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("feedback_comments")
    .select("id, session_id, timestamp_s, text, drawing, x_pct, y_pct, screenshot_url, author_name, author_id, anon_token, created_at, updated_at")
    .eq("session_id", params.id)
    .order("timestamp_s", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const comments = (data ?? []).map((c) => ({
    id: c.id,
    sessionId: c.session_id,
    timestampS: c.timestamp_s,
    text: c.text,
    drawing: c.drawing ?? null,
    xPct: c.x_pct ?? null,
    yPct: c.y_pct ?? null,
    screenshotUrl: c.screenshot_url ?? null,
    authorName: c.author_name,
    authorId: c.author_id ?? null,
    anonToken: c.anon_token ?? null,
    createdAt: new Date(c.created_at).getTime(),
    updatedAt: new Date(c.updated_at).getTime(),
  }));

  return NextResponse.json({ comments });
}

/** POST: add a comment. No auth required — anon users get a token cookie. */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const supabase = getSupabase();
  const session = await getServerSession(authOptions);

  const body = await request.json() as {
    timestampS?: number;
    text?: string;
    drawing?: unknown;
    authorName?: string;
    xPct?: number | null;
    yPct?: number | null;
    screenshotUrl?: string | null;
  };

  const timestampS = typeof body.timestampS === "number" ? body.timestampS : 0;
  const text = (body.text ?? "").trim();
  const authorName = (body.authorName ?? "Anonymous").trim() || "Anonymous";
  const drawing = body.drawing ?? null;
  const xPct = typeof body.xPct === "number" ? body.xPct : null;
  const yPct = typeof body.yPct === "number" ? body.yPct : null;
  const screenshotUrl = body.screenshotUrl ?? null;

  if (!text && !drawing) {
    return NextResponse.json({ error: "text or drawing required" }, { status: 400 });
  }

  let authorId: string | null = null;
  let anonToken: string | null = null;

  if (session?.user?.id) {
    authorId = session.user.id;
  } else {
    anonToken = getOrCreateAnonToken();
  }

  const { data, error } = await supabase
    .from("feedback_comments")
    .insert({
      session_id: params.id,
      timestamp_s: timestampS,
      text,
      drawing,
      x_pct: xPct,
      y_pct: yPct,
      screenshot_url: screenshotUrl,
      author_name: authorName,
      author_id: authorId,
      anon_token: anonToken,
    })
    .select("id, session_id, timestamp_s, text, drawing, x_pct, y_pct, screenshot_url, author_name, author_id, anon_token, created_at, updated_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });

  const comment = {
    id: data.id,
    sessionId: data.session_id,
    timestampS: data.timestamp_s,
    text: data.text,
    drawing: data.drawing ?? null,
    xPct: data.x_pct ?? null,
    yPct: data.y_pct ?? null,
    screenshotUrl: data.screenshot_url ?? null,
    authorName: data.author_name,
    authorId: data.author_id ?? null,
    anonToken: data.anon_token ?? null,
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
  };

  const response = NextResponse.json(comment);

  // Set anon cookie if this is an anonymous user
  if (anonToken && !session?.user?.id) {
    response.cookies.set(ANON_COOKIE, anonToken, {
      httpOnly: false, // accessible from JS for client-side ownership checks
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}
