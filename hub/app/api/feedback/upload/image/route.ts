import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";
  const filename = request.headers.get("x-filename") ?? `image-${Date.now()}.jpg`;

  if (!ALLOWED_TYPES.includes(contentType.split(";")[0].trim())) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, GIF allowed" }, { status: 400 });
  }

  const body = await request.blob();
  if (body.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large (max 20 MB)" }, { status: 400 });
  }

  const result = await put(`feedback/images/${Date.now()}-${filename}`, body, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });

  return NextResponse.json({ url: result.url });
}
