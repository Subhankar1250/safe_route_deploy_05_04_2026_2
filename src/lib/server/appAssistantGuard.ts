/**
 * Hardening for POST /api/app-assistant (CSRF-style abuse, scraping, cost blow-ups).
 *
 * Transport: browsers and Capacitor already use TLS (HTTPS) to your host — that encrypts data in transit.
 * True end-to-end encryption (only the user’s device can read data) is not compatible with this app’s
 * core design: live bus location, admin dashboards, and Supabase-backed search all require the server
 * to understand plaintext. For maximum data protection, rely on TLS + Supabase RLS + strong auth,
 * optional field-level encryption for specific columns, and provider-side encryption at rest.
 */

const assistantBuckets = new Map<string, { count: number; resetAt: number }>();

export function getRequestIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 128);
  return "unknown";
}

function collectAllowedOrigins(): Set<string> {
  const out = new Set<string>();
  const add = (raw?: string | null) => {
    const u = raw?.trim();
    if (!u) return;
    try {
      out.add(new URL(u).origin);
    } catch {
      /* ignore */
    }
  };
  add(process.env.NEXT_PUBLIC_SITE_URL);
  if (process.env.VERCEL_URL) add(`https://${process.env.VERCEL_URL}`);
  const extra = process.env.APP_ASSISTANT_ALLOWED_ORIGINS;
  if (extra) {
    for (const part of extra.split(",")) add(part);
  }
  if (process.env.NODE_ENV !== "production") {
    add("http://localhost:3000");
    add("http://127.0.0.1:3000");
    add("http://localhost:8080");
    add("http://127.0.0.1:8080");
  }
  return out;
}

/** Reduces cross-site POST abuse when the app is deployed with a known public URL. */
export function isAllowedAssistantOrigin(req: Request): boolean {
  if (process.env.APP_ASSISTANT_SKIP_ORIGIN_CHECK === "1") return true;
  if (process.env.NODE_ENV !== "production") return true;

  const allowed = collectAllowedOrigins();
  if (allowed.size === 0) return true;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return allowed.has(new URL(origin).origin);
    } catch {
      return false;
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return allowed.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  return false;
}

/** Fixed window per IP. Best-effort on serverless (each instance has its own map). Prefer Vercel WAF / edge limits for strong global caps. */
export function rateLimitAssistant(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const windowMs = Math.min(
    Math.max(Number(process.env.APP_ASSISTANT_RATE_LIMIT_WINDOW_MS) || 60_000, 5_000),
    3_600_000,
  );
  const max = Math.min(Math.max(Number(process.env.APP_ASSISTANT_RATE_LIMIT_MAX) || 24, 1), 500);
  const now = Date.now();

  if (assistantBuckets.size > 20_000) {
    for (const [key, b] of assistantBuckets) {
      if (now >= b.resetAt) assistantBuckets.delete(key);
    }
  }

  let b = assistantBuckets.get(ip);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    assistantBuckets.set(ip, b);
  }
  b.count += 1;
  if (b.count > max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { ok: true };
}
