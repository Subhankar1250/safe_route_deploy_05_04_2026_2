-- Optional full name (separate from unique username / display handle).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

COMMENT ON COLUMN public.profiles.full_name IS 'Optional legal or full name; username remains the unique display handle.';

-- Fix: RETURNS TABLE (id uuid, ...) creates a PL/pgSQL variable "id", so
-- "WHERE id = ..." against profiles was ambiguous (column vs output param).
CREATE OR REPLACE FUNCTION public.get_admin_pickup_drop_history(
  p_admin_profile_id uuid,
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  student_id uuid,
  student_name text,
  guardian_name text,
  driver_name text,
  event_type text,
  event_time timestamptz,
  bus_number text,
  location_lat numeric,
  location_lng numeric,
  location_name text,
  notes text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := COALESCE(p_limit, 200);
BEGIN
  IF p_admin_profile_id IS NULL THEN
    RAISE EXCEPTION 'admin profile id required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = p_admin_profile_id
      AND pr.user_type IN ('admin', 'guardian_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_limit < 1 OR v_limit > 500 THEN
    v_limit := 200;
  END IF;

  RETURN QUERY
  SELECT
    pdh.id,
    pdh.student_id,
    s.name AS student_name,
    COALESCE(gp.username, gp.email, '') AS guardian_name,
    d.name AS driver_name,
    pdh.event_type,
    pdh.event_time,
    pdh.bus_number,
    pdh.location_lat,
    pdh.location_lng,
    pdh.location_name,
    pdh.notes
  FROM public.pickup_drop_history pdh
  JOIN public.students s ON s.id = pdh.student_id
  LEFT JOIN public.profiles gp ON gp.id = s.guardian_profile_id
  JOIN public.drivers d ON d.id = pdh.driver_id
  ORDER BY pdh.event_time DESC
  LIMIT v_limit;
END;
$$;
