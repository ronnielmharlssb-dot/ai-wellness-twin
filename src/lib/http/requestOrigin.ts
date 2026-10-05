/** Next.js can use its internal hostname in Request.url. Use the public origin
 * explicitly behind a proxy, or the browser's actual Host for direct deployments.
 * Forwarded-Host is not trusted automatically.
 */
export function getRequestOrigin(request: Request): string {
  const configured = process.env.WELLNESS_APP_ORIGIN;
  if (configured) {
    const url = new URL(configured);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("WELLNESS_APP_ORIGIN must be a public HTTP(S) origin without credentials, a path or query.");
    }
    return url.origin;
  }
  const internal = new URL(request.url);
  const host = request.headers.get("host");
  if (!host) return internal.origin;
  if (!/^(?:\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d+)?$/i.test(host)) throw new Error("Invalid request host.");
  const url = new URL(`${internal.protocol}//${host}`);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid request protocol.");
  return url.origin;
}

export function isSameOriginRequest(request: Request): boolean {
  try { return request.headers.get("origin") === getRequestOrigin(request); }
  catch { return false; }
}
