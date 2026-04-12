/**
 * FCM delivery for Supabase Edge (Deno).
 * - Prefer FCM HTTP v1 (Firebase Console → Service account JSON) — works with Web Push tokens.
 * - Fallback: legacy https://fcm.googleapis.com/fcm/send + FCM_SERVER_KEY (older projects).
 */
import { importPKCS8, SignJWT } from "https://esm.sh/jose@5.2.4?target=deno";

export type FcmNotification = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
};

function stringData(data?: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

async function getAccessTokenV1(serviceAccountJson: string): Promise<{ token: string; projectId: string }> {
  const sa = JSON.parse(serviceAccountJson) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error("FCM_SERVICE_ACCOUNT_JSON must include project_id, client_email, private_key");
  }
  const pem = sa.private_key.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "RS256");
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  const tr = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const tj = await tr.json();
  if (!tr.ok || !tj.access_token) {
    throw new Error(`OAuth token for FCM v1 failed: ${JSON.stringify(tj)}`);
  }
  return { token: tj.access_token as string, projectId: sa.project_id };
}

async function sendFcmV1Single(
  accessToken: string,
  projectId: string,
  deviceToken: string,
  n: FcmNotification,
): Promise<unknown> {
  const data = stringData(n.data);
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const openLink =
    typeof n.data?.url === "string" && String(n.data.url).trim()
      ? String(n.data.url)
      : "/guardian/dashboard";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: {
          title: n.title,
          body: n.body,
        },
        data,
        android: {
          priority: "HIGH",
        },
        webpush: {
          notification: {
            title: n.title,
            body: n.body,
            icon: n.icon || "/bus-icon.svg",
            badge: n.badge || "/bus-icon.svg",
          },
          fcm_options: {
            link: openLink,
          },
        },
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    return { error: body, status: res.status };
  }
  return body;
}

async function sendFcmLegacyBatch(
  serverKey: string,
  tokens: string[],
  n: FcmNotification,
): Promise<unknown> {
  const payload = {
    registration_ids: tokens,
    notification: {
      title: n.title,
      body: n.body,
      icon: n.icon || "/bus-icon.svg",
      badge: n.badge || "/bus-icon.svg",
    },
    data: stringData(n.data),
  };
  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`FCM legacy failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

const BATCH = 900;

/**
 * Sends to all tokens; returns list of per-chunk or per-token results for logging.
 */
export async function sendFcmToTokens(
  tokens: string[],
  notification: FcmNotification,
): Promise<{ mode: "v1" | "legacy"; results: unknown[]; errors: string[] }> {
  const uniq = [...new Set(tokens.filter((t) => t && t.length > 20))];
  const results: unknown[] = [];
  const errors: string[] = [];

  const saJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")?.trim();
  const legacyKey = Deno.env.get("FCM_SERVER_KEY")?.trim();

  if (saJson) {
    const { token: accessToken, projectId } = await getAccessTokenV1(saJson);
    for (const t of uniq) {
      try {
        const r = await sendFcmV1Single(accessToken, projectId, t, notification);
        results.push(r);
        if (r && typeof r === "object" && "error" in (r as Record<string, unknown>)) {
          errors.push(`${t.slice(0, 12)}… ${JSON.stringify(r)}`);
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    return { mode: "v1", results, errors };
  }

  if (legacyKey) {
    for (let i = 0; i < uniq.length; i += BATCH) {
      const chunk = uniq.slice(i, i + BATCH);
      try {
        results.push(await sendFcmLegacyBatch(legacyKey, chunk, notification));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    return { mode: "legacy", results, errors };
  }

  throw new Error(
    "Set FCM_SERVICE_ACCOUNT_JSON (recommended) or FCM_SERVER_KEY in Supabase Edge Function secrets for push.",
  );
}

/** FCM only when secrets exist and there is at least one token; otherwise null (Realtime-only is fine). */
export async function sendFcmToTokensIfConfigured(
  tokens: string[],
  notification: FcmNotification,
): Promise<{ mode: "v1" | "legacy"; results: unknown[]; errors: string[] } | null> {
  const saJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")?.trim();
  const legacyKey = Deno.env.get("FCM_SERVER_KEY")?.trim();
  if (!saJson && !legacyKey) return null;
  const uniq = [...new Set(tokens.filter((t) => t && t.length > 20))];
  if (uniq.length === 0) return null;
  return sendFcmToTokens(uniq, notification);
}
