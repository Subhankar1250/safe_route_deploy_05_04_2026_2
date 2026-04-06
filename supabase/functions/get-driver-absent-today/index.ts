import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  driver_id: string;
  /** YYYY-MM-DD (IST) */
  date: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = (await req.json()) as Body;
    const { driver_id, date } = body;
    if (!driver_id || !date) {
      return new Response(JSON.stringify({ error: "driver_id and date required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: students, error: se } = await supabase
      .from("students")
      .select("id")
      .eq("driver_id", driver_id);
    if (se) throw se;

    const ids = (students || []).map((s) => s.id as string).filter(Boolean);
    if (!ids.length) {
      return new Response(JSON.stringify({ absent_student_ids: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rows, error } = await supabase
      .from("student_analytics")
      .select("student_id, attendance_status")
      .eq("date", date)
      .in("student_id", ids);

    if (error) throw error;
    const absent = (rows || [])
      .filter((r) => r.attendance_status === "absent")
      .map((r) => r.student_id as string)
      .filter(Boolean);

    return new Response(JSON.stringify({ absent_student_ids: absent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

