import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Prefs = {
  student_pickup?: boolean;
  reach_school?: boolean;
  leave_school?: boolean;
  student_drop?: boolean;
  quiet_hours_enabled?: boolean;
  quiet_start_ist?: string;
  quiet_end_ist?: string;
};

type Body = {
  guardian_profile_id: string;
  action: "get" | "set";
  preferences?: Prefs;
};

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const body = (await req.json()) as Body;
    const guardianId = body.guardian_profile_id;
    const action = body.action;

    if (!guardianId || !action) {
      return new Response(JSON.stringify({ error: "guardian_profile_id and action are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get") {
      const { data, error } = await supabase
        .from("guardian_notification_preferences")
        .select(
          "student_pickup, reach_school, leave_school, student_drop, quiet_hours_enabled, quiet_start_ist, quiet_end_ist",
        )
        .eq("profile_id", guardianId)
        .maybeSingle();

      if (error) throw error;
      return new Response(
        JSON.stringify({
          preferences: {
            student_pickup: data?.student_pickup !== false,
            reach_school: data?.reach_school !== false,
            leave_school: data?.leave_school !== false,
            student_drop: data?.student_drop !== false,
            quiet_hours_enabled: data?.quiet_hours_enabled === true,
            quiet_start_ist: typeof data?.quiet_start_ist === "string" ? data.quiet_start_ist : "22:00",
            quiet_end_ist: typeof data?.quiet_end_ist === "string" ? data.quiet_end_ist : "06:00",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const prefs = body.preferences ?? {};
    let start = typeof prefs.quiet_start_ist === "string" ? prefs.quiet_start_ist.trim() : "22:00";
    let end = typeof prefs.quiet_end_ist === "string" ? prefs.quiet_end_ist.trim() : "06:00";
    if (!HHMM.test(start)) start = "22:00";
    if (!HHMM.test(end)) end = "06:00";

    const payload = {
      profile_id: guardianId,
      student_pickup: prefs.student_pickup !== false,
      reach_school: prefs.reach_school !== false,
      leave_school: prefs.leave_school !== false,
      student_drop: prefs.student_drop !== false,
      quiet_hours_enabled: prefs.quiet_hours_enabled === true,
      quiet_start_ist: start,
      quiet_end_ist: end,
    };

    const { data, error } = await supabase
      .from("guardian_notification_preferences")
      .upsert(payload, { onConflict: "profile_id" })
      .select(
        "student_pickup, reach_school, leave_school, student_drop, quiet_hours_enabled, quiet_start_ist, quiet_end_ist",
      )
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, preferences: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
