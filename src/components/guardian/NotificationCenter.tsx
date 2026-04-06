import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";
import {
  readGuardianNotificationHistory,
  type GuardianNotificationItem,
} from "@/services/guardianNotificationCenter";
import { useAppLanguage } from "@/contexts/AppLanguageContext";
import {
  fetchGuardianNotificationPrefsFromServer,
  type GuardianNotificationPrefs,
  readGuardianNotificationPrefs,
  writeGuardianNotificationPrefsToServer,
} from "@/services/guardianNotificationPreferences";

export function NotificationCenter({ profileId }: { profileId: string | null }) {
  const [items, setItems] = useState<GuardianNotificationItem[]>([]);
  const [prefs, setPrefs] = useState<GuardianNotificationPrefs | null>(null);
  const { t } = useAppLanguage();

  useEffect(() => {
    if (!profileId) return;
    let alive = true;
    const refresh = () => {
      setItems(readGuardianNotificationHistory(profileId));
      setPrefs(readGuardianNotificationPrefs(profileId));
    };
    refresh();
    void fetchGuardianNotificationPrefsFromServer(profileId).then((serverPrefs) => {
      if (alive) setPrefs(serverPrefs);
    });
    window.addEventListener("guardian-notification-history-updated", refresh);
    window.addEventListener("guardian-notification-prefs-updated", refresh);
    return () => {
      alive = false;
      window.removeEventListener("guardian-notification-history-updated", refresh);
      window.removeEventListener("guardian-notification-prefs-updated", refresh);
    };
  }, [profileId]);

  const toggle = (k: keyof GuardianNotificationPrefs) => {
    if (!profileId || !prefs) return;
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    void writeGuardianNotificationPrefsToServer(profileId, { [k]: !prefs[k] });
  };

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t("guardian.notificationCenter")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {prefs && (
          <div className="mb-4 rounded-lg border border-border/70 p-3">
            <p className="text-sm font-medium">{t("guardian.notificationOptions")}</p>
            <p className="mb-2 text-xs text-muted-foreground">{t("guardian.notificationOptionsHint")}</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.student_pickup}
                  onChange={() => toggle("student_pickup")}
                />
                <span>{t("guardian.notif.studentPickup")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.reach_school}
                  onChange={() => toggle("reach_school")}
                />
                <span>{t("guardian.notif.reachSchool")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.leave_school}
                  onChange={() => toggle("leave_school")}
                />
                <span>{t("guardian.notif.leaveSchool")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.student_drop}
                  onChange={() => toggle("student_drop")}
                />
                <span>{t("guardian.notif.studentDrop")}</span>
              </label>
            </div>
          </div>
        )}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("guardian.noNotifications")}</p>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 20).map((n) => (
              <div key={n.id} className="rounded-lg border border-border/70 p-3">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

