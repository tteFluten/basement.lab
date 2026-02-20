import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { uploadDataUrl, hasBlob } from "@/lib/blob";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** POST: upload avatar image (body: { dataUrl: string }). Returns { url }. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasBlob()) {
    return NextResponse.json(
      { error: "File storage not configured" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : null;
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "dataUrl (image data URL) required" },
      { status: 400 }
    );
  }

  const pathname = `avatars/${session.user.id}/${Date.now()}.png`;
  const url = await uploadDataUrl(dataUrl, pathname);
  if (!url) {
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url });
}
