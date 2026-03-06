import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * One-time endpoint to set CORS on the R2 bucket via Cloudflare REST API.
 * Admin only. Requires CLOUDFLARE_API_TOKEN env var.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accountId || !apiToken || !bucket) {
    return NextResponse.json({
      error: "Missing env vars",
      missing: {
        CLOUDFLARE_ACCOUNT_ID: !accountId,
        CLOUDFLARE_API_TOKEN: !apiToken,
        R2_BUCKET_NAME: !bucket,
      },
    }, { status: 503 });
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/cors`;

  const body = {
    rules: [
      {
        allowed: {
          origins: ["*"],
          methods: ["GET", "PUT", "HEAD"],
          headers: ["*"],
        },
        exposeHeaders: ["ETag"],
        maxAgeSeconds: 3600,
      },
    ],
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: "Cloudflare API error", detail: data }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}
