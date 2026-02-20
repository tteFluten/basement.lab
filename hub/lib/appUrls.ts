/**
 * App dev server URLs when running all apps (see root dev:all).
 * Override via NEXT_PUBLIC_APP_<NAME>_URL if needed.
 */
const defaults: Record<string, string> = {
  cineprompt: "http://localhost:5173",
  pov: "http://localhost:5174",
  chronos: "http://localhost:5175",
  swag: "http://localhost:5176",
  avatar: "http://localhost:5177",
};

export function getAppUrl(slug: string): string {
  if (!slug || typeof slug !== "string") return "#";
  const envKey = `NEXT_PUBLIC_APP_${slug.toUpperCase()}_URL`;
  const env = typeof process !== "undefined" ? (process as NodeJS.Process & { env: Record<string, string> }).env[envKey] : undefined;
  return env || defaults[slug] || "#";
}
