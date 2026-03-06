import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPresignedUpload, hasR2 } from "@/lib/r2";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

/**
 * POST { filename, contentType, size }
 * Returns { uploadUrl, publicUrl } — browser uploads directly to R2 via presigned PUT.
 */
export async function POST(request: NextRequest) {
  if (!hasR2()) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    filename?: string;
    contentType?: string;
    size?: number;
  };

  const { filename, contentType, size } = body;

  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename and contentType required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }
  if (size && size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "File too large (max 500 MB)" }, { status: 400 });
  }

  try {
    const { uploadUrl, filePublicUrl } = await createPresignedUpload(
      filename,
      contentType,
      "feedback/videos"
    );
    return NextResponse.json({ uploadUrl, publicUrl: filePublicUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
