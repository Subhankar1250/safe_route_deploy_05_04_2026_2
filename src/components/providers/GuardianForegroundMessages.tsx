"use client";

import { useEffect, useRef } from "react";
import { useSimpleAuth } from "@/hooks/useSimpleAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  showGuardianAndroidLocalNotification,
  type GuardianBroadcastPayload,
} from "@/lib/guardianRealtimeNotify";
import { appendGuardianNotificationHistory } from "@/services/guardianNotificationCenter";
import { fetchGuardianNotificationPrefsFromServer } from "@/services/guardianNotificationPreferences";

/** Must match `appNotifyTopic` in Supabase Edge `realtimeBroadcast.ts`. */
export const GUARDIAN_APP_NOTIFY_TOPIC_PREFIX = "app-notify-";

function parseBroadcastPayload(raw: unknown): GuardianBroadcastPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title : null;
  const body = typeof o.body === "string" ? o.body : null;
  if (!title || !body) return null;
  const step = typeof o.step === "string" ? o.step : undefined;
  const data = o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : undefined;
  return { title, body, step, data };
}

/**
 * Guardian: Supabase Realtime Broadcast (WebSocket) — no Firebase.
 * Works when the app is open or the WebView is still connected (Android Capacitor).
 * Tray alerts on Android use @capacitor/local-notifications (foreground / short background).
 */
export function GuardianForegroundMessages() {
  const { user } = useSimpleAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const guardianId = user?.user_type === "guardian" ? user.id : null;

  useEffect(() => {
    if (!guardianId) return;
    void fetchGuardianNotificationPrefsFromServer(guardianId);

    const topic = `${GUARDIAN_APP_NOTIFY_TOPIC_PREFIX}${guardianId}`;

    const channel = supabase
      .channel(topic, {
        config: {
          broadcast: { ack: false },
          /** Public channel — must match Edge REST `private: false` (PIN login = anon only). */
          private: false,
        },
      })
      .on(
        "broadcast",
        { event: "notification" },
        (payload: { payload?: unknown }) => {
          const inner = payload?.payload ?? payload;
          const parsed = parseBroadcastPayload(inner);
          if (!parsed) return;
          // Do not filter by localStorage prefs here: Edge Functions already apply
          // guardian_notification_preferences before broadcast; a second filter caused missed toasts.

          toastRef.current({
            title: parsed.title,
            description: parsed.body,
          });

          appendGuardianNotificationHistory(guardianId, {
            title: parsed.title,
            body: parsed.body,
            step: parsed.step,
          });

          void showGuardianAndroidLocalNotification(parsed.title, parsed.body);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[guardian realtime] channel error:", topic);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [guardianId]);

  return null;
}
