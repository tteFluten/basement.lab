import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPresignedUpload, hasR2 } from "@/lib/r2";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

/**
 * Dual-mode upload endpoint.
 *
 * When R2 is configured:
 *   POST { filename, contentType, size } → { mode: "r2", uploadUrl, publicUrl }
 *   Browser then uploads directly to R2 via presigned PUT.
 *
 * When R2 is not configured (fallback to Vercel Blob):
 *   POST { filename, contentType, size } → { mode: "blob" }
 *   Browser then calls upload() from @vercel/blob/client, which calls this same
 *   endpoint again with the handleUpload handshake body.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  // ── R2 path ─────────────────────────────────────────────────────────────
  if (hasR2() && body?.filename) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filename, contentType, size } = body as {
      filename: string;
      contentType: string;
      size?: number;
    };

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
      return NextResponse.json({ mode: "r2", uploadUrl, publicUrl: filePublicUrl });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to generate upload URL" },
        { status: 500 }
      );
    }
  }

  // ── Blob: init probe (tell client to use blob path) ───────────────────
  if (body?.filename && !body?.type) {
    // R2 not configured — tell client to use @vercel/blob/client
    return NextResponse.json({ mode: "blob" });
  }

  // ── Blob: handleUpload handshake (called by @vercel/blob/client upload()) ─
  try {
    const jsonResponse = await handleUpload({
      body: body as HandleUploadBody,
      request,
      onBeforeGenerateToken: async () => {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) throw new Error("Unauthorized");
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Feedback video uploaded (Blob):", blob.url);
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 }
    );
  }
}
