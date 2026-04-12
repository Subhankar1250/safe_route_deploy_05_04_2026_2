import { supabase } from "@/integrations/supabase/client";

export type TripPushStep =
  | "trip_started"
  | "pickup_journey_started"
  | "drop_journey_started"
  | "pickup_journey_ended"
  | "drop_journey_ended"
  | "trip_ended"
  | "student_pickup"
  | "student_drop"
  /** Driver tap: running late — reaches all guardians on this bus (not filtered by trip prefs). */
  | "driver_delay_notice";

/**
 * Notify all guardians whose children are assigned to this driver (FCM via Edge Function).
 * Fails softly — never throws to the driver UI.
 */
export async function notifyDriverGuardians(params: {
  driverId: string;
  title: string;
  body: string;
  step: TripPushStep;
  data?: Record<string, string | number | boolean | null | undefined>;
}): Promise<void> {
  const { driverId, title, body, step, data: payloadData } = params;
  if (!driverId || !title || !body) return;

  try {
    const clean: Record<string, unknown> = { step };
    if (payloadData) {
      for (const [k, v] of Object.entries(payloadData)) {
        if (v !== undefined && v !== null) clean[k] = v;
      }
    }

    const { data, error } = await supabase.functions.invoke("notify-driver-guardians", {
      body: {
        driver_id: driverId,
        title,
        body,
        step,
        data: clean,
      },
    });

    if (error) {
      console.warn("[notify-driver-guardians]", error.message, error);
    } else if (data && typeof data === "object" && "message" in data && (data as { message?: string }).message) {
      console.info("[notify-driver-guardians]", (data as { message: string }).message, data);
    }
  } catch (e) {
    console.warn("[notify-driver-guardians]", e);
  }
}
