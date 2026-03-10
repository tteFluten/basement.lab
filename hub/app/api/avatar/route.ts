import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { uploadBuffer, hasR2 } from "@/lib/r2";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/** POST: upload avatar image (body: { dataUrl: string }). Returns { url }. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasR2()) {
    return NextResponse.json(
      { error: "File storage (R2) not configured" },
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

  const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const buffer = Buffer.from(b64, "base64");
  const key = `avatars/${session.user.id}/${Date.now()}.png`;

  try {
    const url = await uploadBuffer(key, buffer, "image/png");
    return NextResponse.json({ url });
  } catch (e) {
    console.error("Avatar upload failed:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
