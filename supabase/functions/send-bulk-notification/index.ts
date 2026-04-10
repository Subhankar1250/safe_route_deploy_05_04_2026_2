import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { sendFcmToTokensIfConfigured, type FcmNotification } from "../_shared/fcmSend.ts";
import { broadcastToProfiles, type AppBroadcastPayload } from "../_shared/realtimeBroadcast.ts";
import { storeGuardianNotifications } from "../_shared/guardianNotificationsStore.ts";
import { sendGuardianWhatsAppByProfileIds } from "../_shared/whatsappWebhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  userTypes?: string[];
}

async function collectAllTargetTokens(
  supabase: ReturnType<typeof createClient>,
  userTypes?: string[],
): Promise<string[]> {
  const out = new Set<string>();

  if (userTypes && userTypes.length > 0) {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, fcm_token")
      .in("user_type", userTypes);

    if (error) throw error;

    const ids: string[] = [];
    for (const p of profiles || []) {
      ids.push(p.id);
      if (p.fcm_token) out.add(p.fcm_token);
    }

    if (ids.length > 0) {
      const { data: gpts } = await supabase
        .from("guardian_push_tokens")
        .select("token")
        .in("profile_id", ids);

      for (const g of gpts || []) {
        if (g.token) out.add(g.token);
      }
    }
  } else {
    const { data: withFcm, error: e1 } = await supabase
      .from("profiles")
      .select("fcm_token")
      .not("fcm_token", "is", null);

    if (e1) throw e1;
    for (const p of withFcm || []) {
      if (p.fcm_token) out.add(p.fcm_token);
    }

    const { data: gpts, error: e2 } = await supabase
      .from("guardian_push_tokens")
      .select("token");

    if (e2) throw e2;
    for (const g of gpts || []) {
      if (g.token) out.add(g.token);
    }
  }

  return [...out];
}

async function collectProfileIdsForBulk(
  supabase: ReturnType<typeof createClient>,
  userTypes?: string[],
): Promise<string[]> {
  if (userTypes && userTypes.length > 0) {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id")
      .in("user_type", userTypes);

    if (error) throw error;
    return [...new Set((profiles || []).map((p) => p.id as string).filter(Boolean))];
  }

  const { data: profiles, error } = await supabase.from("profiles").select("id");
  if (error) throw error;
  return [...new Set((profiles || []).map((p) => p.id as string).filter(Boolean))];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const requestBody: NotificationRequest = await req.json();
    const { title, body, icon, badge, data, userTypes } = requestBody;

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "Title and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profileIds = await collectProfileIdsForBulk(supabaseClient, userTypes);

    const rtPayload: AppBroadcastPayload = {
      title,
      body,
      step: typeof data?.type === "string" ? String(data.type) : "bulk_announcement",
      data: data ?? { type: "bulk_announcement" },
    };

    const { ok: rtOk, fail: rtFail } = await broadcastToProfiles(
      profileIds,
      rtPayload,
      "notification",
    );

    const tokens = await collectAllTargetTokens(supabaseClient, userTypes);

    const notification: FcmNotification = { title, body, icon, badge, data };
    const fcm = await sendFcmToTokensIfConfigured(tokens, notification);
    const failedCount = fcm?.errors.length ?? 0;
    const sentCount = fcm ? Math.max(0, tokens.length - failedCount) : 0;

    const step = typeof data?.type === "string" ? String(data.type) : "bulk_announcement";
    const guardianProfileIds =
      userTypes && userTypes.length > 0
        ? userTypes.includes("guardian")
          ? profileIds
          : []
        : profileIds;
    if (guardianProfileIds.length > 0) {
      await storeGuardianNotifications(supabaseClient, {
        guardianIds: guardianProfileIds,
        title,
        body,
        step,
        payload: data ?? {},
      });
    }

    const wa =
      guardianProfileIds.length > 0
        ? await sendGuardianWhatsAppByProfileIds(
            supabaseClient,
            guardianProfileIds,
            `${title}\n${body}`,
            step,
            "send-bulk-notification",
          )
        : { attempted: 0, sent: 0, failed: 0, errors: [] };

    const { error: logError } = await supabaseClient.from("notification_logs").insert({
      title: `BULK: ${title}`,
      body,
      user_type: userTypes?.length ? userTypes.join(",") : "all",
      tokens_sent: sentCount,
      fcm_response: {
        mode: fcm?.mode ?? null,
        total_tokens: tokens.length,
        profile_count: profileIds.length,
        whatsapp: wa,
        realtime_broadcast_ok: rtOk,
        realtime_broadcast_fail: rtFail,
        batches: fcm?.results.length ?? 0,
        failed_tokens: failedCount,
        results: fcm?.results,
        errors: fcm?.errors,
      },
    });

    if (logError) {
      console.error("Error logging notification:", logError);
    }

    return new Response(
      JSON.stringify({
        message: "Bulk notification completed",
        mode: fcm?.mode ?? "realtime",
        total_tokens: tokens.length,
        total_profiles: profileIds.length,
        sent: sentCount,
        failed: failedCount,
        realtime_broadcast: { ok: rtOk, fail: rtFail },
        errors: fcm?.errors?.length ? fcm.errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Bulk notification error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
