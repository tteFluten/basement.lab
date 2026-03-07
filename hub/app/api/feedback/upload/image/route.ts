import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPresignedUpload, hasR2 } from "@/lib/r2";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Same dual-mode pattern as /api/feedback/upload (video), but for images.
 *
 * R2 path:  POST { filename, contentType, size } → { mode: "r2", uploadUrl, publicUrl }
 * Blob path: POST { filename, contentType, size } → { mode: "blob" }
 *            then client calls @vercel/blob/client upload() which re-calls this endpoint.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  // ── R2 path ──────────────────────────────────────────────────────────────
  if (hasR2() && body?.filename) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { filename, contentType, size } = body as { filename: string; contentType: string; size?: number };

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

  // ── Blob: init probe ──────────────────────────────────────────────────────
  if (body?.filename && !body?.type) {
    return NextResponse.json({ mode: "blob" });
  }

  // ── Blob: handleUpload handshake ──────────────────────────────────────────
  try {
    const jsonResponse = await handleUpload({
      body: body as HandleUploadBody,
      request,
      onBeforeGenerateToken: async () => {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) throw new Error("Unauthorized");
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Feedback image uploaded (Blob):", blob.url);
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}
