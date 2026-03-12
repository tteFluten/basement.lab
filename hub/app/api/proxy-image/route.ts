import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const ALLOWED_HOSTS = [
  process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null,
].filter(Boolean) as string[];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  let parsed: URL;
  try { parsed = new URL(url); } catch { return new NextResponse("Invalid url", { status: 400 }); }

  // Only allow fetching from our own R2 bucket
  if (ALLOWED_HOSTS.length > 0 && !ALLOWED_HOSTS.some(h => parsed.hostname.endsWith(h))) {
    return new NextResponse("Forbidden host", { status: 403 });
  }

  const res = await fetch(url);
  if (!res.ok) return new NextResponse(`Upstream error: ${res.status}`, { status: 502 });

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const body = await res.arrayBuffer();

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
