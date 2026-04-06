import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

type Supabase = ReturnType<typeof createClient>;

export async function storeGuardianNotifications(
  supabase: Supabase,
  params: {
    guardianIds: string[];
    title: string;
    body: string;
    step: string;
    driverId?: string;
    studentId?: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const { guardianIds, title, body, step, driverId, studentId, payload } = params;
  if (!guardianIds.length || !title || !body || !step) return;

  const rows = guardianIds.map((gid) => ({
    guardian_profile_id: gid,
    driver_id: driverId ?? null,
    student_id: studentId ?? null,
    event_step: step,
    title,
    body,
    payload: payload ?? {},
  }));

  const { error } = await supabase.from("guardian_notifications").insert(rows);
  if (error) {
    console.warn("[guardian_notifications] insert failed:", error.message);
  }
}

