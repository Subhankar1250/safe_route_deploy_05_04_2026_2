import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  guardian_profile_id: string;
  guardian_mobile?: string;
  student_id: string;
  /** YYYY-MM-DD (IST) */
  date: string;
  attendance_status: "present" | "absent" | "late";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = (await req.json()) as Body;
    const { guardian_profile_id, guardian_mobile, student_id, date, attendance_status } = body;

    if (!guardian_profile_id || !student_id || !date || !attendance_status) {
      return new Response(JSON.stringify({ error: "guardian_profile_id, student_id, date, attendance_status required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify guardian owns this student
    const { data: student, error: se } = await supabase
      .from("students")
      .select("id, guardian_profile_id, guardian_mobile, driver_id")
      .eq("id", student_id)
      .maybeSingle();

    if (se) throw se;
    if (!student) {
      return new Response(JSON.stringify({ error: "Not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let allowed = student.guardian_profile_id === guardian_profile_id;
    if (!allowed && guardian_mobile && student.guardian_mobile) {
      const reqMobile = String(guardian_mobile).replace(/\D/g, "");
      const sMobile = String(student.guardian_mobile ?? "").replace(/\D/g, "");
      if (reqMobile && sMobile && (reqMobile === sMobile || reqMobile.endsWith(sMobile) || sMobile.endsWith(reqMobile))) {
        allowed = true;
      }
    }
    if (!allowed && student.guardian_mobile) {
      const { data: profileById } = await supabase
        .from("profiles")
        .select("mobile_number")
        .eq("id", guardian_profile_id)
        .maybeSingle();
      const pMobile = String(profileById?.mobile_number ?? "").replace(/\D/g, "");
      const sMobile = String(student.guardian_mobile ?? "").replace(/\D/g, "");
      if (pMobile && sMobile && (pMobile === sMobile || pMobile.endsWith(sMobile) || sMobile.endsWith(pMobile))) {
        allowed = true;
      }
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Not allowed for this student" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upsertError } = await supabase
      .from("student_analytics")
      .upsert(
        {
          student_id,
          date,
          attendance_status,
        },
        { onConflict: "student_id,date" },
      );

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

