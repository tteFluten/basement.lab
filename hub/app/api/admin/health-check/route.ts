import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, hasDb } from "@/lib/db";
import { getGemini, hasGemini } from "@/lib/gemini";
import { hasR2 } from "@/lib/r2";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export type CheckStatus = "ok" | "error" | "warn" | "skip";

export type CheckResult = {
  id: string;
  name: string;
  status: CheckStatus;
  message: string;
  detail?: string;
  durationMs?: number;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - start };
}

async function checkEnvVars(): Promise<CheckResult> {
  const required = [
    "GEMINI_API_KEY",
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "CLOUDFLARE_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return {
      id: "env",
      name: "Environment Variables",
      status: "error",
      message: `${missing.length} variable(s) missing`,
      detail: `Missing: ${missing.join(", ")}`,
    };
  }
  return { id: "env", name: "Environment Variables", status: "ok", message: "All required vars present" };
}

async function checkDatabase(): Promise<CheckResult[]> {
  if (!hasDb()) {
    return [{ id: "db-conn", name: "Database Connection", status: "error", message: "DATABASE_URL not set" }];
  }
  const results: CheckResult[] = [];

  // Connection
  try {
    const { ms } = await timed(async () => {
      const db = getDb();
      await db.from("users").select("id").limit(1);
    });
    results.push({ id: "db-conn", name: "Database Connection", status: "ok", message: `Connected (${ms}ms)`, durationMs: ms });
  } catch (e) {
    results.push({ id: "db-conn", name: "Database Connection", status: "error", message: "Connection failed", detail: String(e) });
    return results;
  }

  // Tables
  const tables = ["users", "generations", "projects", "feedback_projects", "patas_global_memory", "patas_inbox"];
  for (const table of tables) {
    try {
      const { ms } = await timed(async () => {
        const db = getDb();
        await db.from(table).select("*").limit(1);
      });
      results.push({ id: `db-${table}`, name: `DB table: ${table}`, status: "ok", message: `Readable (${ms}ms)`, durationMs: ms });
    } catch (e) {
      results.push({ id: `db-${table}`, name: `DB table: ${table}`, status: "error", message: "Query failed", detail: String(e) });
    }
  }

  return results;
}

function makeR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

async function checkR2(): Promise<CheckResult[]> {
  if (!hasR2()) {
    return [{ id: "r2", name: "R2 Storage", status: "error", message: "R2 credentials not configured" }];
  }
  const results: CheckResult[] = [];
  const testKey = `_health-check/test-${Date.now()}.txt`;
  const bucket = process.env.R2_BUCKET_NAME!;
  const r2 = makeR2Client();

  // Write
  try {
    const { ms } = await timed(() => r2.send(new PutObjectCommand({ Bucket: bucket, Key: testKey, Body: "ok", ContentType: "text/plain" })));
    results.push({ id: "r2-write", name: "R2 Write", status: "ok", message: `Wrote test file (${ms}ms)`, durationMs: ms });
  } catch (e) {
    results.push({ id: "r2-write", name: "R2 Write", status: "error", message: "Write failed", detail: String(e) });
    return results;
  }

  // Read
  try {
    const { ms } = await timed(() => r2.send(new GetObjectCommand({ Bucket: bucket, Key: testKey })));
    results.push({ id: "r2-read", name: "R2 Read", status: "ok", message: `Read test file (${ms}ms)`, durationMs: ms });
  } catch (e) {
    results.push({ id: "r2-read", name: "R2 Read", status: "error", message: "Read failed", detail: String(e) });
  }

  // Delete
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
    results.push({ id: "r2-delete", name: "R2 Cleanup", status: "ok", message: "Deleted test file" });
  } catch (e) {
    results.push({ id: "r2-delete", name: "R2 Cleanup", status: "warn", message: "Could not delete test file", detail: String(e) });
  }

  return results;
}

async function checkGemini(): Promise<CheckResult> {
  if (!hasGemini()) {
    return { id: "gemini", name: "Gemini API", status: "error", message: "GEMINI_API_KEY not set" };
  }
  try {
    const { ms } = await timed(async () => {
      const ai = getGemini();
      await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }],
        config: { maxOutputTokens: 5 },
      });
    });
    return { id: "gemini", name: "Gemini API (text)", status: "ok", message: `Response received (${ms}ms)`, durationMs: ms };
  } catch (e) {
    return { id: "gemini", name: "Gemini API (text)", status: "error", message: "API call failed", detail: String(e) };
  }
}

async function checkGeminiImage(): Promise<CheckResult> {
  if (!hasGemini()) {
    return { id: "gemini-img", name: "Gemini Image Model", status: "skip", message: "Skipped (API key missing)" };
  }
  try {
    const { ms } = await timed(async () => {
      const ai = getGemini();
      await ai.models.generateContent({
        model: "imagen-3.0-fast-generate-001",
        contents: [{ role: "user", parts: [{ text: "a red circle" }] }],
        config: { maxOutputTokens: 1 },
      });
    });
    return { id: "gemini-img", name: "Gemini Image Model", status: "ok", message: `Model reachable (${ms}ms)`, durationMs: ms };
  } catch (e) {
    const msg = String(e);
    // RESOURCE_EXHAUSTED / quota errors are still "reachable"
    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || msg.includes("429")) {
      return { id: "gemini-img", name: "Gemini Image Model", status: "warn", message: "Quota/rate limit hit (model reachable)", detail: msg };
    }
    return { id: "gemini-img", name: "Gemini Image Model", status: "error", message: "Model unreachable", detail: msg };
  }
}

async function checkApps(): Promise<CheckResult[]> {
  const slugs = ["cineprompt", "chronos", "swag", "avatar", "render", "frame-variator", "nanobanana"];
  const embedBase = path.join(process.cwd(), "public", "embed");
  return slugs.map((slug) => {
    const indexPath = path.join(embedBase, slug, "index.html");
    const exists = fs.existsSync(indexPath);
    return {
      id: `app-${slug}`,
      name: `App: ${slug}`,
      status: exists ? "ok" : "error",
      message: exists ? "index.html present" : "index.html NOT FOUND — needs rebuild",
      detail: exists ? undefined : `Expected at: public/embed/${slug}/index.html`,
    } satisfies CheckResult;
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [envCheck, dbChecks, r2Checks, geminiCheck, geminiImgCheck, appChecks] = await Promise.all([
    checkEnvVars(),
    checkDatabase(),
    checkR2(),
    checkGemini(),
    checkGeminiImage(),
    checkApps(),
  ]);

  const checks: CheckResult[] = [
    envCheck,
    ...dbChecks,
    ...r2Checks,
    geminiCheck,
    geminiImgCheck,
    ...appChecks,
  ];

  const errors = checks.filter((c) => c.status === "error");
  const warnings = checks.filter((c) => c.status === "warn");

  return NextResponse.json({ checks, errors: errors.length, warnings: warnings.length, timestamp: new Date().toISOString() });
}
