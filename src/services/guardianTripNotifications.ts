import { supabase } from "@/integrations/supabase/client";

export type TripPushStep =
  | "trip_started"
  | "pickup_journey_started"
  | "drop_journey_started"
  | "pickup_journey_ended"
  | "drop_journey_ended"
  | "trip_ended"
  | "student_pickup"
  | "student_drop";

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
  const { driverId, title, body, step, data } = params;
  if (!driverId || !title || !body) return;

  try {
    const clean: Record<string, unknown> = { step };
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined && v !== null) clean[k] = v;
      }
    }

    const { error } = await supabase.functions.invoke("notify-driver-guardians", {
      body: {
        driver_id: driverId,
        title,
        body,
        step,
        data: clean,
      },
    });

    if (error) {
      console.warn("[notify-driver-guardians]", error.message);
    }
  } catch (e) {
    console.warn("[notify-driver-guardians]", e);
  }
}
