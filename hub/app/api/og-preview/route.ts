import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface OgData {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  url: string;
}

function extractMeta(html: string, url: string): OgData {
  const get = (pattern: RegExp): string | null => {
    const m = html.match(pattern);
    return m?.[1]?.trim() || null;
  };

  const ogTitle = get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    ?? get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const ogDesc = get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    ?? get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  const ogImage = get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const ogSiteName = get(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    ?? get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);

  const title = ogTitle ?? get(/<title[^>]*>([^<]+)<\/title>/i);
  const description = ogDesc ?? get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    ?? get(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

  let favicon = get(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)
    ?? get(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);

  const base = new URL(url);
  if (favicon && !favicon.startsWith("http")) {
    favicon = new URL(favicon, base.origin).href;
  }
  if (!favicon) {
    favicon = `${base.origin}/favicon.ico`;
  }

  let image = ogImage;
  if (image && !image.startsWith("http")) {
    image = new URL(image, base.origin).href;
  }

  return { title, description, image, siteName: ogSiteName, favicon, url };
}

/** GET: fetch OG metadata for a URL. Query: ?url=... */
export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url");
  if (!targetUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  try {
    new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BasementLabBot/1.0)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({
        title: null, description: null, image: null,
        siteName: null, favicon: `${new URL(targetUrl).origin}/favicon.ico`, url: targetUrl,
      });
    }

    const html = await res.text();
    const og = extractMeta(html.slice(0, 50000), targetUrl);

    return NextResponse.json(og, {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
