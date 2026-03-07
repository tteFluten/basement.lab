import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadBuffer, hasR2 } from "@/lib/r2";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Captures a screenshot of a URL using Microlink API (free, no key required)
 * then stores it in R2 (primary) or Vercel Blob (fallback) for permanent reference.
 *
 * Set MICROLINK_API_KEY env var to increase rate limits.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { url?: string };
  const url = body.url?.trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const apiKey = process.env.MICROLINK_API_KEY;
    const microlinkUrl = new URL("https://api.microlink.io/");
    microlinkUrl.searchParams.set("url", url);
    microlinkUrl.searchParams.set("screenshot", "true");
    microlinkUrl.searchParams.set("meta", "false");
    microlinkUrl.searchParams.set("embed", "screenshot.url");
    if (apiKey) microlinkUrl.searchParams.set("apikey", apiKey);

    const mlRes = await fetch(microlinkUrl.toString(), {
      headers: { "User-Agent": "basement-lab-feedback/1.0" },
    });

    if (!mlRes.ok) return NextResponse.json({ screenshotUrl: null });

    const mlData = await mlRes.json() as { status: string; data?: { screenshot?: { url?: string } } };
    const screenshotSrcUrl = mlData?.data?.screenshot?.url;
    if (!screenshotSrcUrl) return NextResponse.json({ screenshotUrl: null });

    // Download and re-store for permanence
    const imgRes = await fetch(screenshotSrcUrl);
    if (!imgRes.ok) return NextResponse.json({ screenshotUrl: null });

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const key = `feedback/screenshots/ss-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

    let screenshotUrl: string;
    if (hasR2()) {
      screenshotUrl = await uploadBuffer(key, imgBuffer, "image/png");
    } else {
      const result = await put(key, imgBuffer, { access: "public", addRandomSuffix: false, contentType: "image/png" });
      screenshotUrl = result.url;
    }

    return NextResponse.json({ screenshotUrl });
  } catch (e) {
    console.error("Screenshot capture failed:", e);
    return NextResponse.json({ screenshotUrl: null });
  }
}
