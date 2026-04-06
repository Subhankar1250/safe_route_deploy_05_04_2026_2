import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";
import {
  readGuardianNotificationHistory,
  type GuardianNotificationItem,
} from "@/services/guardianNotificationCenter";

export function NotificationCenter({ profileId }: { profileId: string | null }) {
  const [items, setItems] = useState<GuardianNotificationItem[]>([]);

  useEffect(() => {
    if (!profileId) return;
    const refresh = () => setItems(readGuardianNotificationHistory(profileId));
    refresh();
    window.addEventListener("guardian-notification-history-updated", refresh);
    return () => window.removeEventListener("guardian-notification-history-updated", refresh);
  }, [profileId]);

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Center
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
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

