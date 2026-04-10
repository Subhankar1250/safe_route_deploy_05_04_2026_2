import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { sendFcmToTokensIfConfigured, type FcmNotification } from "../_shared/fcmSend.ts";
import { broadcastToProfiles, type AppBroadcastPayload } from "../_shared/realtimeBroadcast.ts";
import { filterGuardianIdsByPreference } from "../_shared/guardianNotificationPrefs.ts";
import { storeGuardianNotifications } from "../_shared/guardianNotificationsStore.ts";
import { sendGuardianWhatsAppByProfileIds } from "../_shared/whatsappWebhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Body = {
  driver_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** e.g. trip_started | pickup_journey_started | drop_journey_started | trip_ended */
  step?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const json: Body = await req.json();
    const { driver_id, title, body, data, step } = json;

    if (!driver_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: "driver_id, title, and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: students, error: se } = await supabase
      .from("students")
      .select("guardian_profile_id")
      .eq("driver_id", driver_id)
      .not("guardian_profile_id", "is", null);

    if (se) throw se;

    const guardianIdsRaw = [
      ...new Set(
        (students || [])
          .map((s) => s.guardian_profile_id as string)
          .filter(Boolean),
      ),
    ];

    const guardianIds = await filterGuardianIdsByPreference(supabase, guardianIdsRaw, step);

    if (guardianIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No guardians for this driver/step preference", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const broadcastPayload: AppBroadcastPayload = {
      title,
      body,
      step: step ?? "trip_update",
      data: {
        ...data,
        url: "/guardian/dashboard",
        step: step ?? "trip_update",
      },
    };

    const { ok: rtOk, fail: rtFail } = await broadcastToProfiles(
      guardianIds,
      broadcastPayload,
      "notification",
    );

    const tokenSet = new Set<string>();
    for (const gid of guardianIds) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("fcm_token")
        .eq("id", gid)
        .maybeSingle();
      if (profile?.fcm_token) tokenSet.add(profile.fcm_token);

      const { data: gptRows } = await supabase
        .from("guardian_push_tokens")
        .select("token")
        .eq("profile_id", gid);
      for (const row of gptRows || []) {
        if (row?.token) tokenSet.add(row.token);
      }
    }

    const tokens = [...tokenSet];

    const notification: FcmNotification = {
      title,
      body,
      icon: "/bus-icon.svg",
      badge: "/bus-icon.svg",
      data: {
        ...data,
        step: step ?? "trip_update",
        url: "/guardian/dashboard",
      },
    };

    const fcm = await sendFcmToTokensIfConfigured(tokens, notification);

    await storeGuardianNotifications(supabase, {
      guardianIds,
      title,
      body,
      step: step ?? "trip_update",
      driverId: driver_id,
      studentId: typeof data?.student_id === "string" ? data.student_id : undefined,
      payload: {
        ...(data ?? {}),
        url: "/guardian/dashboard",
      },
    });

    const waMessage = `${title}\n${body}`;
    const wa = await sendGuardianWhatsAppByProfileIds(
      supabase,
      guardianIds,
      waMessage,
      step ?? "trip_update",
      "notify-driver-guardians",
    );

    await supabase.from("notification_logs").insert({
      user_type: "guardian",
      title: `DRIVER_BROADCAST: ${title}`,
      body,
      tokens_sent: fcm ? Math.max(0, tokens.length - fcm.errors.length) : 0,
      fcm_response: {
        realtime_broadcast_ok: rtOk,
        realtime_broadcast_fail: rtFail,
        driver_id,
        step,
        guardian_count: guardianIds.length,
        whatsapp: wa,
        fcm_tokens: tokens.length,
        fcm: fcm
          ? { mode: fcm.mode, error_count: fcm.errors.length, results: fcm.results }
          : null,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        guardians: guardianIds.length,
        realtime_broadcast: { ok: rtOk, fail: rtFail },
        fcm_tokens: tokens.length,
        fcm_mode: fcm?.mode ?? null,
        fcm_errors: fcm?.errors?.length ? fcm.errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("notify-driver-guardians:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
