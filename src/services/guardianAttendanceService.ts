import { supabase } from "@/integrations/supabase/client";
import { todayIstDate } from "@/utils/istDate";

export async function markStudentAbsentToday(params: {
  guardianProfileId: string;
  studentId: string;
  absent: boolean;
}): Promise<{ ok: boolean; message?: string }> {
  const { guardianProfileId, studentId, absent } = params;
  if (!guardianProfileId || !studentId) return { ok: false, message: "Missing ids" };

  const { data, error } = await supabase.functions.invoke("mark-student-absent", {
    body: {
      guardian_profile_id: guardianProfileId,
      student_id: studentId,
      date: todayIstDate(),
      attendance_status: absent ? "absent" : "present",
    },
  });

  if (error) return { ok: false, message: error.message };
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    return { ok: false, message: String((data as { error: string }).error) };
  }
  return { ok: true };
}

