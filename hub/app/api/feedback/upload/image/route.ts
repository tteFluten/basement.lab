import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPresignedUpload, hasR2 } from "@/lib/r2";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Upload endpoint for feedback images via R2 presigned URLs.
 *
 * POST { filename, contentType, size } → { mode: "r2", uploadUrl, publicUrl }
 * Browser then uploads directly to R2 via presigned PUT.
 */
export async function POST(request: NextRequest) {
  if (!hasR2()) {
    return NextResponse.json({ error: "File storage (R2) not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { filename, contentType, size } = body as { filename: string; contentType: string; size?: number };

  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename and contentType required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, GIF allowed" }, { status: 400 });
  }
  if (size && size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });
  }

  try {
    const { uploadUrl, filePublicUrl } = await createPresignedUpload(
      filename,
      contentType,
      "feedback/images"
    );
    return NextResponse.json({ mode: "r2", uploadUrl, publicUrl: filePublicUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
