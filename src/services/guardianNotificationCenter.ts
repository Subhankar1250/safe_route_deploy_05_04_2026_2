export type GuardianNotificationItem = {
  id: string;
  title: string;
  body: string;
  step?: string;
  createdAt: string;
};

function key(profileId: string): string {
  return `guardian_notification_history_${profileId}`;
}

export function readGuardianNotificationHistory(profileId: string): GuardianNotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(profileId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GuardianNotificationItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendGuardianNotificationHistory(
  profileId: string,
  item: Omit<GuardianNotificationItem, "id" | "createdAt">,
): GuardianNotificationItem {
  const next: GuardianNotificationItem = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...item,
  };
  if (typeof window === "undefined") return next;
  const prev = readGuardianNotificationHistory(profileId);
  const updated = [next, ...prev].slice(0, 100);
  localStorage.setItem(key(profileId), JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("guardian-notification-history-updated"));
  return next;
}

