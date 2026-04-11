import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

type Supabase = ReturnType<typeof createClient>;

function normalizeIndianPhoneNumber(input: string): string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;

  // Keep only digits, then normalize to +91XXXXXXXXXX when possible.
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = `91${digits.slice(1)}`;
  } else if (digits.length === 12 && digits.startsWith("91")) {
    // already fine
  } else {
    return null;
  }

  return `+${digits}`;
}

export async function sendWhatsAppNotification(params: {
  phoneNumber: string;
  message: string;
  step?: string;
  source?: string;
  extra?: Record<string, unknown>;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const webhookUrl = Deno.env.get("N8N_WHATSAPP_WEBHOOK_URL")?.trim();
  if (!webhookUrl) {
    return { ok: false, error: "N8N_WHATSAPP_WEBHOOK_URL not configured" };
  }

  const normalized = normalizeIndianPhoneNumber(params.phoneNumber);
  if (!normalized) {
    return { ok: false, error: "Invalid phone number format" };
  }

  try {
    const lower = webhookUrl.toLowerCase();
    /** ngrok free tier interstitial + some WAFs block bare server fetches without a browser-like UA. */
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "SaveRoute-Supabase-Edge/1.0 (+https://saferoute.sishutirtha.co.in)",
    };
    if (lower.includes("ngrok-free.") || lower.includes("ngrok.io")) {
      headers["ngrok-skip-browser-warning"] = "true";
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phoneNumber: normalized,
        message: params.message,
        step: params.step ?? "trip_update",
        source: params.source ?? "supabase-edge",
        ...params.extra,
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: t || `Webhook HTTP ${res.status}` };
    }

    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendGuardianWhatsAppByProfileIds(
  supabase: Supabase,
  guardianProfileIds: string[],
  message: string,
  step?: string,
  source?: string,
): Promise<{
  attempted: number;
  sent: number;
  failed: number;
  errors: Array<{ profile_id: string; phone?: string | null; error: string }>;
}> {
  const ids = [...new Set(guardianProfileIds.filter(Boolean))];
  if (ids.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, errors: [] };
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, mobile_number, user_type")
    .in("id", ids)
    .eq("user_type", "guardian");

  if (error) {
    return {
      attempted: ids.length,
      sent: 0,
      failed: ids.length,
      errors: ids.map((id) => ({ profile_id: id, error: error.message })),
    };
  }

  let attempted = 0;
  let sent = 0;
  const errors: Array<{ profile_id: string; phone?: string | null; error: string }> = [];

  for (const p of profiles || []) {
    attempted += 1;
    if (!p.mobile_number) {
      errors.push({ profile_id: p.id, phone: null, error: "Missing mobile_number" });
      continue;
    }

    const wa = await sendWhatsAppNotification({
      phoneNumber: p.mobile_number,
      message,
      step,
      source,
      extra: { profile_id: p.id },
    });

    if (wa.ok) sent += 1;
    else errors.push({ profile_id: p.id, phone: p.mobile_number, error: wa.error ?? "Unknown error" });
  }

  return {
    attempted,
    sent,
    failed: Math.max(0, attempted - sent),
    errors,
  };
}
