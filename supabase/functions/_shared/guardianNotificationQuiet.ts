import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

type Supabase = ReturnType<typeof createClient>;

function minutesNowIST(): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return h * 60 + m;
}

function parseHHMM(s: string): number | null {
  const t = (s ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/** Inclusive start, exclusive end in minute-of-day; supports overnight window (e.g. 22:00–06:00). */
function isInQuietWindow(nowMin: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return false;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin;
}

export type QuietPrefsRow = {
  profile_id: string;
  quiet_hours_enabled: boolean;
  quiet_start_ist: string;
  quiet_end_ist: string;
};

/** Guardians who should NOT receive push (quiet hours). Realtime/in-app can still deliver separately. */
export async function filterOutQuietHoursGuardians(
  supabase: Supabase,
  guardianIds: string[],
  opts?: { skipQuiet?: boolean },
): Promise<string[]> {
  if (opts?.skipQuiet || guardianIds.length === 0) return guardianIds;

  const { data, error } = await supabase
    .from("guardian_notification_preferences")
    .select("profile_id, quiet_hours_enabled, quiet_start_ist, quiet_end_ist")
    .in("profile_id", guardianIds);

  if (error) {
    console.warn("[quiet hours] query failed:", error.message);
    return guardianIds;
  }

  const nowMin = minutesNowIST();
  const rowMap = new Map<string, QuietPrefsRow>();
  for (const row of data || []) {
    rowMap.set(String(row.profile_id), row as QuietPrefsRow);
  }

  return guardianIds.filter((id) => {
    const row = rowMap.get(id);
    if (!row || !row.quiet_hours_enabled) return true;
    const start = parseHHMM(row.quiet_start_ist ?? "22:00") ?? 22 * 60;
    const end = parseHHMM(row.quiet_end_ist ?? "06:00") ?? 6 * 60;
    return !isInQuietWindow(nowMin, start, end);
  });
}
