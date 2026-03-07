import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadBuffer, hasR2 } from "@/lib/r2";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Image files only" }, { status: 400 });
  }

  const blob = await request.blob();
  if (blob.size > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "Thumbnail too large (max 3MB)" }, { status: 400 });
  }

  const ext = contentType.includes("png") ? "png" : "jpg";
  const key = `feedback/thumbnails/thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  if (hasR2()) {
    const buffer = Buffer.from(await blob.arrayBuffer());
    const url = await uploadBuffer(key, buffer, contentType);
    return NextResponse.json({ url });
  }

  const result = await put(key, blob, { access: "public", addRandomSuffix: false });
  return NextResponse.json({ url: result.url });
}
