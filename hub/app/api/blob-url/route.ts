import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { resolveBlobUrl } from "@/lib/blob";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** GET: resolve a blob URL to a short-lived display URL. Requires session. */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url query required" }, { status: 400 });
  }

  try {
    const resolved = await resolveBlobUrl(url);
    return NextResponse.json({ url: resolved });
  } catch (e) {
    console.warn("blob-url resolve failed:", e);
    return NextResponse.json({ error: "Failed to resolve URL" }, { status: 500 });
  }
}
