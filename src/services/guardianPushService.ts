import { supabase } from "@/integrations/supabase/client";

/** Remove guardian row in DB (no-op if profile is not `user_type = guardian`). */
export async function clearGuardianPushTokenRow(profileId: string): Promise<void> {
  if (!profileId) return;
  try {
    const { error } = await supabase.rpc("delete_guardian_push_token", {
      p_profile_id: profileId,
    });
    if (error) console.warn("[guardian push] delete_guardian_push_token:", error.message);
  } catch (e) {
    console.warn("[guardian push] clear row failed:", e);
  }
}

/** Drop FCM registration in this browser (stops delivery until user registers again). */
export async function invalidateLocalFcmMessaging(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { getMessaging, deleteToken, isSupported } = await import("firebase/messaging");
    const { default: app } = await import("@/config/firebase");
    const ok = await isSupported().catch(() => false);
    if (!ok) return;
    await deleteToken(getMessaging(app));
  } catch {
    /* no token or messaging unavailable */
  }
}

/** Guardian sign-out: clear DB token + invalidate browser FCM. */
export async function revokeGuardianWebPush(profileId: string): Promise<void> {
  await clearGuardianPushTokenRow(profileId);
  await invalidateLocalFcmMessaging();
}

/**
 * Register Firebase Web FCM token for this guardian profile so Edge Functions / bulk send can reach them.
 * Requires `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (Firebase Console → Project settings → Cloud Messaging → Web Push certificates).
 */
export async function registerGuardianWebPush(profileId: string): Promise<boolean> {
  if (typeof window === "undefined" || !profileId) return false;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
  if (!vapidKey) {
    console.info(
      "[guardian push] Set NEXT_PUBLIC_FIREBASE_VAPID_KEY to enable browser push (Firebase → Cloud Messaging → Web Push).",
    );
    return false;
  }

  try {
    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    const { default: app } = await import("@/config/firebase");

    const supported = await isSupported().catch(() => false);
    if (!supported) return false;

    if (!("Notification" in window)) return false;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) return false;

    const { error } = await supabase.rpc("upsert_guardian_push_token", {
      p_profile_id: profileId,
      p_token: token,
      p_platform: "web",
    });

    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("[guardian push] registration failed:", e);
    return false;
  }
}

/** Sends a test FCM to this guardian (skips quiet hours). Requires FCM configured on project. */
export async function sendGuardianTestPush(profileId: string): Promise<{ ok: boolean; message: string }> {
  if (!profileId) return { ok: false, message: "Not signed in" };
  try {
    const { data, error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        userId: profileId,
        notification: {
          title: "Safe Route — test notification",
          body: "If you see this, push is working. You can dismiss this message.",
          data: {
            url: "/guardian/dashboard",
            skip_quiet_hours: true,
          },
        },
      },
    });
    if (error) throw error;
    const err = (data as { error?: string } | null)?.error;
    if (err) return { ok: false, message: err };
    return { ok: true, message: "Test sent. Check your device notification tray." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not send test push",
    };
  }
}
