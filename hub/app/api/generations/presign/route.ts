import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createPresignedUpload, hasR2 } from "@/lib/r2";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST: get presigned PUT URLs so the client can upload images directly to R2,
 * bypassing the server as an intermediary for binary data.
 * Body: { appId: string }
 * Returns: { imageUploadUrl, imageUrl, thumbUploadUrl, thumbUrl }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasR2()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const { appId } = body as { appId?: string };
  if (!appId || typeof appId !== "string") {
    return NextResponse.json({ error: "appId required" }, { status: 400 });
  }

  const ts = Date.now();
  const folder = `generations/${appId}`;

  const [img, thumb] = await Promise.all([
    createPresignedUpload(`${ts}.png`, "image/png", folder),
    createPresignedUpload(`${ts}_thumb.jpg`, "image/jpeg", folder),
  ]);

  return NextResponse.json({
    imageUploadUrl: img.uploadUrl,
    imageUrl: img.filePublicUrl,
    thumbUploadUrl: thumb.uploadUrl,
    thumbUrl: thumb.filePublicUrl,
  });
}
