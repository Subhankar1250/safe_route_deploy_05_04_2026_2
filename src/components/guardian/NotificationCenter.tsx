import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Send } from "lucide-react";
import {
  readGuardianNotificationHistory,
  type GuardianNotificationItem,
} from "@/services/guardianNotificationCenter";
import { useAppLanguage } from "@/contexts/AppLanguageContext";
import {
  fetchGuardianNotificationPrefsFromServer,
  type GuardianNotificationPrefs,
  type GuardianNotificationType,
  readGuardianNotificationPrefs,
  writeGuardianNotificationPrefsToServer,
} from "@/services/guardianNotificationPreferences";
import { sendGuardianTestPush } from "@/services/guardianPushService";
import { useToast } from "@/hooks/use-toast";

export function NotificationCenter({ profileId }: { profileId: string | null }) {
  const [items, setItems] = useState<GuardianNotificationItem[]>([]);
  const [prefs, setPrefs] = useState<GuardianNotificationPrefs | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const { t } = useAppLanguage();
  const { toast } = useToast();

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

  const toggleTrip = (k: GuardianNotificationType) => {
    if (!profileId || !prefs) return;
    const next = !prefs[k];
    setPrefs({ ...prefs, [k]: next });
    void writeGuardianNotificationPrefsToServer(profileId, { [k]: next });
  };

  const updateQuiet = (patch: Partial<Pick<GuardianNotificationPrefs, "quiet_hours_enabled" | "quiet_start_ist" | "quiet_end_ist">>) => {
    if (!profileId || !prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    void writeGuardianNotificationPrefsToServer(profileId, patch);
  };

  const runTestPush = async () => {
    if (!profileId) return;
    setTestLoading(true);
    try {
      const r = await sendGuardianTestPush(profileId);
      toast({
        title: r.ok ? t("guardian.testPushOkTitle") : t("guardian.testPushFailTitle"),
        description: r.message,
        variant: r.ok ? "default" : "destructive",
      });
    } finally {
      setTestLoading(false);
    }
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
          <div className="mb-4 space-y-4">
            <div className="rounded-lg border border-border/70 p-3">
              <p className="text-sm font-medium">{t("guardian.notificationOptions")}</p>
              <p className="mb-2 text-xs text-muted-foreground">{t("guardian.notificationOptionsHint")}</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={prefs.student_pickup}
                    onChange={() => toggleTrip("student_pickup")}
                  />
                  <span>{t("guardian.notif.studentPickup")}</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={prefs.reach_school}
                    onChange={() => toggleTrip("reach_school")}
                  />
                  <span>{t("guardian.notif.reachSchool")}</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={prefs.leave_school}
                    onChange={() => toggleTrip("leave_school")}
                  />
                  <span>{t("guardian.notif.leaveSchool")}</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={prefs.student_drop}
                    onChange={() => toggleTrip("student_drop")}
                  />
                  <span>{t("guardian.notif.studentDrop")}</span>
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 p-3">
              <p className="text-sm font-medium">{t("guardian.quietHoursTitle")}</p>
              <p className="mb-2 text-xs text-muted-foreground">{t("guardian.quietHoursHint")}</p>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.quiet_hours_enabled}
                  onChange={() => updateQuiet({ quiet_hours_enabled: !prefs.quiet_hours_enabled })}
                />
                <span>{t("guardian.quietHoursEnable")}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">{t("guardian.quietFrom")}</span>
                  <input
                    className="rounded border border-input bg-background px-2 py-1 text-sm"
                    value={prefs.quiet_start_ist}
                    onChange={(e) => updateQuiet({ quiet_start_ist: e.target.value })}
                    placeholder="22:00"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">{t("guardian.quietTo")}</span>
                  <input
                    className="rounded border border-input bg-background px-2 py-1 text-sm"
                    value={prefs.quiet_end_ist}
                    onChange={(e) => updateQuiet({ quiet_end_ist: e.target.value })}
                    placeholder="06:00"
                  />
                </label>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              disabled={testLoading}
              onClick={() => void runTestPush()}
            >
              <Send className="mr-2 h-4 w-4" />
              {testLoading ? t("common.loading") : t("guardian.testPushButton")}
            </Button>
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
