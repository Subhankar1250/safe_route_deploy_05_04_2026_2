import { isNativeAndroidApp } from "@/lib/nativeAndroidApp";

export type GuardianBroadcastPayload = {
  title: string;
  body: string;
  step?: string;
  data?: Record<string, unknown>;
};

let localNotificationsReady: Promise<boolean> | null = null;

/**
 * Android (Capacitor): show a tray notification when the WebView receives a Realtime broadcast.
 * Does not use Firebase; requires POST_NOTIFICATIONS permission (requested on first use).
 */
export async function showGuardianAndroidLocalNotification(
  title: string,
  body: string,
): Promise<void> {
  if (!isNativeAndroidApp() || typeof window === "undefined") return;

  if (!localNotificationsReady) {
    localNotificationsReady = (async () => {
      try {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const { display } = await LocalNotifications.requestPermissions();
        if (display !== "granted") return false;
        await LocalNotifications.createChannel({
          id: "guardian-trip",
          name: "Trip & bus updates",
          importance: 4,
          visibility: 1,
        });
        return true;
      } catch {
        return false;
      }
    })();
  }

  const ok = await localNotificationsReady;
  if (!ok) return;

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const id = Math.floor(Math.random() * 2147483646) + 1;
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          channelId: "guardian-trip",
          schedule: { at: new Date(Date.now() + 300) },
        },
      ],
    });
  } catch {
    /* ignore */
  }
}
