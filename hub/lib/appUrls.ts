/**
 * Unified mode: apps are built into hub/public/embed/<name>/ and served at /embed/<name>/.
 * Override with NEXT_PUBLIC_APP_<NAME>_URL to use a dev server instead.
 */
const unifiedPath = (slug: string) => `/embed/${slug}/index.html`;
const BUILT_EMBED_SLUGS = new Set([
  "cineprompt",
  "pov",
  "chronos",
  "swag",
  "avatar",
  "render",
  "frame-variator",
  "connect",
]);

export function getAppUrl(slug: string): string {
  if (!slug || typeof slug !== "string") return "#";
  const envKey = `NEXT_PUBLIC_APP_${slug.toUpperCase()}_URL`;
  const env = typeof process !== "undefined" ? (process as NodeJS.Process & { env: Record<string, string> }).env[envKey] : undefined;
  if (env) return env;
  if (BUILT_EMBED_SLUGS.has(slug)) return unifiedPath(slug);
  return "#";
}
