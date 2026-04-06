-- Short status lines from drivers to admins (works with profile-based login via RPC).

CREATE TABLE IF NOT EXISTS public.driver_quick_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) >= 1 AND char_length(message) <= 280),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_quick_status_created_at ON public.driver_quick_status (created_at DESC);

ALTER TABLE public.driver_quick_status ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.driver_post_quick_status(
  p_driver_profile_id uuid,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
  v_msg text;
  new_id uuid;
BEGIN
  IF p_driver_profile_id IS NULL THEN
    RAISE EXCEPTION 'profile required' USING ERRCODE = '42501';
  END IF;

  SELECT d.id INTO v_driver_id
  FROM public.drivers d
  WHERE d.profile_id = p_driver_profile_id
  LIMIT 1;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'not a driver' USING ERRCODE = '42501';
  END IF;

  v_msg := trim(both from coalesce(p_message, ''));
  IF length(v_msg) < 1 OR length(v_msg) > 280 THEN
    RAISE EXCEPTION 'message must be 1–280 characters';
  END IF;

  INSERT INTO public.driver_quick_status (driver_id, message)
  VALUES (v_driver_id, v_msg)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_driver_quick_status(
  p_admin_profile_id uuid,
  p_limit int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim int := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);
  result jsonb;
BEGIN
  IF p_admin_profile_id IS NULL THEN
    RAISE EXCEPTION 'admin profile id required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_profile_id AND user_type IN ('admin', 'guardian_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'message', x.message,
          'created_at', x.created_at,
          'driver_name', x.driver_name,
          'bus_number', x.bus_number
        ) ORDER BY x.created_at DESC
      )
      FROM (
        SELECT s.id, s.message, s.created_at, d.name AS driver_name, d.bus_number
        FROM public.driver_quick_status s
        INNER JOIN public.drivers d ON d.id = s.driver_id
        ORDER BY s.created_at DESC
        LIMIT lim
      ) x
    ),
    '[]'::jsonb
  )
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_post_quick_status(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.driver_post_quick_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_driver_quick_status(uuid, int) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_list_driver_quick_status(uuid, int) TO authenticated;
