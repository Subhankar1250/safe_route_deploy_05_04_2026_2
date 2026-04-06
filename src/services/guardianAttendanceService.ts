import { supabase } from "@/integrations/supabase/client";
import { todayIstDate } from "@/utils/istDate";

function toMessage(value: unknown, fallback = "Request failed"): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value instanceof Error && value.message) return value.message;
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const nested =
      rec.error ??
      rec.message ??
      rec.details ??
      rec.hint ??
      rec.code;
    if (typeof nested === "string" && nested.trim()) return nested;
    if (nested && typeof nested === "object") {
      const deep = toMessage(nested, "");
      if (deep) return deep;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function markStudentAbsentToday(params: {
  guardianProfileId: string;
  guardianMobile?: string;
  studentId: string;
  absent: boolean;
}): Promise<{ ok: boolean; message?: string }> {
  const { guardianProfileId, guardianMobile, studentId, absent } = params;
  if (!guardianProfileId || !studentId) return { ok: false, message: "Missing ids" };

  const { data, error } = await supabase.functions.invoke("mark-student-absent", {
    body: {
      guardian_profile_id: guardianProfileId,
      guardian_mobile: guardianMobile,
      student_id: studentId,
      date: todayIstDate(),
      attendance_status: absent ? "absent" : "present",
    },
  });

  if (error) {
    const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (ctx?.json) {
      try {
        const j = await ctx.json();
        const msg = toMessage(j, toMessage(error));
        return {
          ok: false,
          message: msg,
        };
      } catch {
        /* ignore */
      }
    }
    return { ok: false, message: toMessage(error) };
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error) {
    return { ok: false, message: toMessage((data as { error?: unknown }).error) };
  }
  return { ok: true };
}

