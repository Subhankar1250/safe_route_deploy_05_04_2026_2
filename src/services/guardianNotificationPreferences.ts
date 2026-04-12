import { supabase } from "@/integrations/supabase/client";

export type GuardianNotificationType =
  | "student_pickup"
  | "reach_school"
  | "leave_school"
  | "student_drop";

export type GuardianNotificationPrefs = {
  student_pickup: boolean;
  reach_school: boolean;
  leave_school: boolean;
  student_drop: boolean;
  quiet_hours_enabled: boolean;
  quiet_start_ist: string;
  quiet_end_ist: string;
};

const DEFAULT_PREFS: GuardianNotificationPrefs = {
  student_pickup: true,
  reach_school: true,
  leave_school: true,
  student_drop: true,
  quiet_hours_enabled: false,
  quiet_start_ist: "22:00",
  quiet_end_ist: "06:00",
};

function prefsKey(profileId: string): string {
  return `guardian_notification_prefs_${profileId}`;
}

function normalizePrefs(p: Partial<GuardianNotificationPrefs> | undefined): GuardianNotificationPrefs {
  return {
    student_pickup: p?.student_pickup !== false,
    reach_school: p?.reach_school !== false,
    leave_school: p?.leave_school !== false,
    student_drop: p?.student_drop !== false,
    quiet_hours_enabled: p?.quiet_hours_enabled === true,
    quiet_start_ist:
      typeof p?.quiet_start_ist === "string" && /^\d{1,2}:\d{2}$/.test(p.quiet_start_ist)
        ? p.quiet_start_ist
        : DEFAULT_PREFS.quiet_start_ist,
    quiet_end_ist:
      typeof p?.quiet_end_ist === "string" && /^\d{1,2}:\d{2}$/.test(p.quiet_end_ist)
        ? p.quiet_end_ist
        : DEFAULT_PREFS.quiet_end_ist,
  };
}

export function readGuardianNotificationPrefs(profileId: string): GuardianNotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(prefsKey(profileId));
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<GuardianNotificationPrefs>;
    return normalizePrefs(parsed);
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writeGuardianNotificationPrefs(
  profileId: string,
  patch: Partial<GuardianNotificationPrefs>,
): GuardianNotificationPrefs {
  const next = normalizePrefs({ ...readGuardianNotificationPrefs(profileId), ...patch });
  if (typeof window !== "undefined") {
    localStorage.setItem(prefsKey(profileId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("guardian-notification-prefs-updated"));
  }
  return next;
}

export async function fetchGuardianNotificationPrefsFromServer(
  profileId: string,
): Promise<GuardianNotificationPrefs> {
  try {
    const { data, error } = await supabase.functions.invoke("guardian-notification-preferences", {
      body: {
        guardian_profile_id: profileId,
        action: "get",
      },
    });
    if (error) throw error;
    const prefs = (data as { preferences?: Partial<GuardianNotificationPrefs> } | null)?.preferences;
    const merged = normalizePrefs(prefs);
    writeGuardianNotificationPrefs(profileId, merged);
    return merged;
  } catch {
    return readGuardianNotificationPrefs(profileId);
  }
}

export async function writeGuardianNotificationPrefsToServer(
  profileId: string,
  patch: Partial<GuardianNotificationPrefs>,
): Promise<GuardianNotificationPrefs> {
  const optimistic = writeGuardianNotificationPrefs(profileId, patch);
  try {
    const { data, error } = await supabase.functions.invoke("guardian-notification-preferences", {
      body: {
        guardian_profile_id: profileId,
        action: "set",
        preferences: optimistic,
      },
    });
    if (error) throw error;
    const prefs = (data as { preferences?: Partial<GuardianNotificationPrefs> } | null)?.preferences;
    return writeGuardianNotificationPrefs(profileId, normalizePrefs(prefs ?? optimistic));
  } catch {
    return optimistic;
  }
}

export function mapStepToNotificationType(step?: string): GuardianNotificationType | null {
  switch (step) {
    case "student_pickup":
      return "student_pickup";
    case "pickup_journey_ended":
      return "reach_school";
    case "drop_journey_started":
      return "leave_school";
    case "student_drop":
      return "student_drop";
    default:
      return null;
  }
}
