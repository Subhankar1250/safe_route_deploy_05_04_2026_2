import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

type Supabase = ReturnType<typeof createClient>;

export type GuardianNotificationPrefKey =
  | "student_pickup"
  | "reach_school"
  | "leave_school"
  | "student_drop";

export function mapStepToPrefKey(step?: string): GuardianNotificationPrefKey | null {
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

export async function filterGuardianIdsByPreference(
  supabase: Supabase,
  guardianIds: string[],
  step?: string,
): Promise<string[]> {
  const prefKey = mapStepToPrefKey(step);
  if (!prefKey || guardianIds.length === 0) return guardianIds;

  const { data, error } = await supabase
    .from("guardian_notification_preferences")
    .select("profile_id, student_pickup, reach_school, leave_school, student_drop")
    .in("profile_id", guardianIds);

  if (error) {
    console.warn("[guardian pref filter] query failed:", error.message);
    return guardianIds;
  }

  const prefMap = new Map<string, Record<string, boolean>>();
  for (const row of data || []) {
    prefMap.set(String(row.profile_id), {
      student_pickup: row.student_pickup !== false,
      reach_school: row.reach_school !== false,
      leave_school: row.leave_school !== false,
      student_drop: row.student_drop !== false,
    });
  }

  // Missing row means default-allow.
  return guardianIds.filter((id) => prefMap.get(id)?.[prefKey] !== false);
}

