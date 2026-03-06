import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

/** One-time endpoint to set CORS on the R2 bucket. Admin only. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return NextResponse.json({ error: "R2 env vars not configured" }, { status: 503 });
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  try {
    await client.send(new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["*"],
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("PutBucketCors failed:", msg);
    return NextResponse.json({ error: "PutBucketCors failed", detail: msg }, { status: 500 });
  }

  try {
    const result = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    return NextResponse.json({ ok: true, rules: result.CORSRules });
  } catch (e) {
    return NextResponse.json({ ok: true, note: "Set but could not verify", error: String(e) });
  }
}
