import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { sendFcmToTokensIfConfigured, type FcmNotification } from "../_shared/fcmSend.ts";
import { broadcastToProfile, type AppBroadcastPayload } from "../_shared/realtimeBroadcast.ts";
import { filterGuardianIdsByPreference } from "../_shared/guardianNotificationPrefs.ts";
import { filterOutQuietHoursGuardians } from "../_shared/guardianNotificationQuiet.ts";
import { storeGuardianNotifications } from "../_shared/guardianNotificationsStore.ts";

type Supabase = ReturnType<typeof createClient>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  userId?: string;
  userType?: string;
  notification: FcmNotification;
}

async function collectProfileIdsForUserType(
  supabase: Supabase,
  userType: string,
): Promise<string[]> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_type", userType);

  if (error) throw error;
  return (profiles || []).map((p) => p.id as string).filter(Boolean);
}

async function collectTokensForProfileIds(
  supabase: Supabase,
  profileIds: string[],
): Promise<string[]> {
  if (profileIds.length === 0) return [];
  const out = new Set<string>();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, fcm_token")
    .in("id", profileIds);
  for (const p of profiles || []) {
    if (p?.fcm_token) out.add(p.fcm_token);
  }

  const { data: gpts } = await supabase
    .from("guardian_push_tokens")
    .select("token")
    .in("profile_id", profileIds);
  for (const g of gpts || []) {
    if (g?.token) out.add(g.token);
  }

  return [...out];
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

    const { userId, userType, notification }: NotificationPayload =
      await req.json();

    if (!userId && !userType) {
      return new Response(
        JSON.stringify({ error: "userId or userType is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!notification?.title || !notification?.body) {
      return new Response(
        JSON.stringify({ error: "notification.title and notification.body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    /** Realtime + in-app center: keep full audience (PIN guardians often have no Supabase Auth). */
    let broadcastProfileIds: string[] = [];
    /** FCM only: honour guardian_notification_preferences + quiet hours. */
    let fcmProfileIds: string[] = [];

    if (userId) {
      broadcastProfileIds = [userId];
      fcmProfileIds = [userId];
    } else if (userType) {
      broadcastProfileIds = await collectProfileIdsForUserType(
        supabaseClient,
        userType,
      );
      fcmProfileIds = [...broadcastProfileIds];
    }

    const step = typeof notification?.data?.step === "string" ? notification.data.step : undefined;

    if (userId && step) {
      const pushOk = await filterGuardianIdsByPreference(supabaseClient, [userId], step);
      fcmProfileIds = pushOk.length > 0 ? pushOk : [];
    } else if (userType === "guardian" && step) {
      const pushOk = await filterGuardianIdsByPreference(
        supabaseClient,
        fcmProfileIds,
        step,
      );
      fcmProfileIds = pushOk;
    }

    const skipQuiet =
      notification?.data?.skip_quiet_hours === true ||
      String(notification?.data?.skip_quiet_hours ?? "") === "true";
    fcmProfileIds = await filterOutQuietHoursGuardians(supabaseClient, fcmProfileIds, {
      skipQuiet,
    });
    const tokens = await collectTokensForProfileIds(supabaseClient, fcmProfileIds);

    const n = notification;
    const rtPayload: AppBroadcastPayload = {
      title: n.title,
      body: n.body,
      step: typeof n.data?.step === "string" ? n.data.step : undefined,
      data: {
        ...(n.data ?? {}),
        url: typeof n.data?.url === "string" ? n.data.url : "/guardian/dashboard",
      },
    };

    let rtOk = 0;
    let rtFail = 0;
    for (const pid of broadcastProfileIds) {
      const r = await broadcastToProfile(pid, rtPayload, "notification");
      if (r.ok) rtOk += 1;
      else rtFail += 1;
    }

    const fcm = await sendFcmToTokensIfConfigured(tokens, notification);

    if (broadcastProfileIds.length > 0) {
      await storeGuardianNotifications(supabaseClient, {
        guardianIds: broadcastProfileIds,
        title: notification.title,
        body: notification.body,
        step: step ?? "direct_notification",
        driverId: typeof notification.data?.driver_id === "string" ? notification.data.driver_id : undefined,
        studentId: typeof notification.data?.student_id === "string" ? notification.data.student_id : undefined,
        payload: {
          ...(notification.data ?? {}),
          url: typeof notification.data?.url === "string" ? notification.data.url : "/guardian/dashboard",
        },
      });
    }

    if (!fcm && tokens.length === 0 && broadcastProfileIds.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No recipients (no profile id / user type for broadcast)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!fcm && tokens.length === 0 && broadcastProfileIds.length > 0) {
      await supabaseClient.from("notification_logs").insert({
        user_id: userId,
        user_type: userType,
        title: notification.title,
        body: notification.body,
        tokens_sent: 0,
        fcm_response: {
          realtime_only: true,
          realtime_broadcast_ok: rtOk,
          realtime_broadcast_fail: rtFail,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          mode: "realtime",
          realtime_broadcast: { ok: rtOk, fail: rtFail },
          fcm_tokens_sent: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!fcm && tokens.length > 0) {
      await supabaseClient.from("notification_logs").insert({
        user_id: userId,
        user_type: userType,
        title: notification.title,
        body: notification.body,
        tokens_sent: 0,
        fcm_response: {
          error: "FCM not configured",
          realtime_broadcast_ok: rtOk,
          realtime_broadcast_fail: rtFail,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          mode: "realtime",
          realtime_broadcast: { ok: rtOk, fail: rtFail },
          message: "Realtime delivered; FCM not configured",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabaseClient.from("notification_logs").insert({
      user_id: userId,
      user_type: userType,
      title: notification.title,
      body: notification.body,
      tokens_sent: fcm ? Math.max(0, tokens.length - fcm.errors.length) : 0,
      fcm_response: {
        mode: fcm?.mode,
        realtime_broadcast_ok: rtOk,
        realtime_broadcast_fail: rtFail,
        results: fcm?.results,
        errors: fcm?.errors,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        mode: fcm?.mode ?? "realtime",
        tokens_sent: tokens.length,
        fcm_result: fcm?.results,
        errors: fcm?.errors?.length ? fcm.errors : undefined,
        realtime_broadcast: { ok: rtOk, fail: rtFail },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
