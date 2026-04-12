/**
 * Push events to connected clients via Supabase Realtime Broadcast (WebSocket).
 * Works with the anon key + public channel — no Firebase and no Supabase Auth JWT required
 * (needed for this app’s PIN-based guardian login).
 *
 * REST: https://supabase.com/docs/guides/realtime/broadcast
 */
export type AppBroadcastPayload = {
  title: string;
  body: string;
  /** e.g. trip_started | student_pickup | bulk_announcement */
  step?: string;
  data?: Record<string, unknown>;
};

/** Channel topic clients subscribe to: `app-notify-${profileId}` */
export function appNotifyTopic(profileId: string): string {
  return `app-notify-${profileId}`;
}

export async function broadcastToProfile(
  profileId: string,
  payload: AppBroadcastPayload,
  event = "notification",
): Promise<{ ok: boolean; status: number; text?: string }> {
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) {
    console.warn("broadcastToProfile: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return { ok: false, status: 0, text: "missing env" };
  }

  const topic = appNotifyTopic(profileId);
  const endpoint = `${url}/realtime/v1/api/broadcast`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      messages: [
        {
          topic,
          event,
          payload,
          /** Must match public `supabase.channel(topic)` — private broadcasts do not reach anon/PIN guardians. */
          private: false,
        },
      ],
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.warn("broadcastToProfile failed:", res.status, text);
    return { ok: false, status: res.status, text };
  }
  return { ok: true, status: res.status, text };
}

export async function broadcastToProfiles(
  profileIds: string[],
  payload: AppBroadcastPayload,
  event = "notification",
  concurrency = 12,
): Promise<{ ok: number; fail: number }> {
  const uniq = [...new Set(profileIds.filter(Boolean))];
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < uniq.length; i += concurrency) {
    const chunk = uniq.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map((id) => broadcastToProfile(id, payload, event)),
    );
    for (const r of results) {
      if (r.ok) ok += 1;
      else fail += 1;
    }
  }

  return { ok, fail };
}
