import { supabase } from "@/integrations/supabase/client";

export type GuardianNotificationType =
  | "student_pickup"
  | "reach_school"
  | "leave_school"
  | "student_drop";

export type GuardianNotificationPrefs = Record<GuardianNotificationType, boolean>;

const DEFAULT_PREFS: GuardianNotificationPrefs = {
  student_pickup: true,
  reach_school: true,
  leave_school: true,
  student_drop: true,
};

function prefsKey(profileId: string): string {
  return `guardian_notification_prefs_${profileId}`;
}

export function readGuardianNotificationPrefs(profileId: string): GuardianNotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(prefsKey(profileId));
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<GuardianNotificationPrefs>;
    return {
      student_pickup: parsed.student_pickup !== false,
      reach_school: parsed.reach_school !== false,
      leave_school: parsed.leave_school !== false,
      student_drop: parsed.student_drop !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writeGuardianNotificationPrefs(
  profileId: string,
  patch: Partial<GuardianNotificationPrefs>,
): GuardianNotificationPrefs {
  const next = { ...readGuardianNotificationPrefs(profileId), ...patch };
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
    const prefs = (data as { preferences?: Partial<GuardianNotificationPrefs> } | null)?.preferences ?? {};
    const merged: GuardianNotificationPrefs = {
      student_pickup: prefs.student_pickup !== false,
      reach_school: prefs.reach_school !== false,
      leave_school: prefs.leave_school !== false,
      student_drop: prefs.student_drop !== false,
    };
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
    const prefs = (data as { preferences?: Partial<GuardianNotificationPrefs> } | null)?.preferences ?? {};
    return writeGuardianNotificationPrefs(profileId, {
      student_pickup: prefs.student_pickup !== false,
      reach_school: prefs.reach_school !== false,
      leave_school: prefs.leave_school !== false,
      student_drop: prefs.student_drop !== false,
    });
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

