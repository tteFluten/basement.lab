import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { resolveBlobUrl } from "@/lib/blob";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** GET: resolve a private blob URL to a signed download URL. Query: url (encoded). */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  try {
    const decoded = decodeURIComponent(url);
    const resolved = await resolveBlobUrl(decoded);
    return NextResponse.json({ url: resolved });
  } catch (e) {
    console.warn("resolve-url failed:", e);
    return NextResponse.json({ error: "Failed to resolve" }, { status: 500 });
  }
}
