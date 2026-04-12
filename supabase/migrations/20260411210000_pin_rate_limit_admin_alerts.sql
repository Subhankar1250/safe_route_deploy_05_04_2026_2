-- PIN brute-force throttling (per mobile + role) and admin operational snapshot.

CREATE TABLE IF NOT EXISTS public.portal_pin_login_throttle (
  login_key text PRIMARY KEY,
  fail_count int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_pin_login_throttle_locked_idx
  ON public.portal_pin_login_throttle (locked_until)
  WHERE locked_until IS NOT NULL;

COMMENT ON TABLE public.portal_pin_login_throttle IS 'Failed PIN attempts for verify_portal_pin_login; locks after 8 failures for 15 minutes.';

CREATE OR REPLACE FUNCTION public.verify_portal_pin_login(
  p_mobile text,
  p_pin text,
  p_user_type text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v10 text;
  v_key text;
  p public.profiles%ROWTYPE;
  th public.portal_pin_login_throttle%ROWTYPE;
BEGIN
  IF p_mobile IS NULL OR p_pin IS NULL OR p_user_type IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_user_type NOT IN ('guardian', 'driver') THEN
    RETURN NULL;
  END IF;
  IF p_pin !~ '^\d{6}$' THEN
    RETURN NULL;
  END IF;

  v10 := public.last10_digits(p_mobile);
  IF v10 IS NULL OR length(v10) <> 10 THEN
    RETURN NULL;
  END IF;

  v_key := v10 || '|' || lower(p_user_type);

  SELECT * INTO th FROM public.portal_pin_login_throttle WHERE login_key = v_key;
  IF FOUND AND th.locked_until IS NOT NULL AND th.locked_until > now() THEN
    RETURN json_build_object(
      'error', 'rate_limited',
      'locked_until', th.locked_until
    );
  END IF;

  IF FOUND AND th.locked_until IS NOT NULL AND th.locked_until <= now() THEN
    UPDATE public.portal_pin_login_throttle
    SET fail_count = 0, locked_until = NULL, updated_at = now()
    WHERE login_key = v_key;
  END IF;

  SELECT * INTO p
  FROM public.profiles pr
  WHERE pr.user_type = p_user_type
    AND public.last10_digits(pr.mobile_number) = v10
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF p.portal_pin_hash IS NULL THEN
    RETURN json_build_object('error', 'no_pin_set');
  END IF;

  IF crypt(p_pin, p.portal_pin_hash) <> p.portal_pin_hash THEN
    INSERT INTO public.portal_pin_login_throttle (login_key, fail_count, locked_until, updated_at)
    VALUES (v_key, 1, NULL, now())
    ON CONFLICT (login_key) DO UPDATE SET
      fail_count = public.portal_pin_login_throttle.fail_count + 1,
      locked_until = CASE
        WHEN public.portal_pin_login_throttle.fail_count + 1 >= 8 THEN now() + interval '15 minutes'
        ELSE public.portal_pin_login_throttle.locked_until
      END,
      updated_at = now();

    RETURN NULL;
  END IF;

  DELETE FROM public.portal_pin_login_throttle WHERE login_key = v_key;

  RETURN json_build_object(
    'id', p.id,
    'email', COALESCE(p.email, ''),
    'username', p.username,
    'mobile_number', p.mobile_number,
    'user_type', p.user_type
  );
END;
$$;

-- Admin: quick operational flags (panic, stale live pings, active trips).
CREATE OR REPLACE FUNCTION public.get_admin_operational_alerts(p_admin_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panic int := 0;
  v_stale int := 0;
  v_active_trips int := 0;
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

  SELECT COUNT(*)::int INTO v_panic
  FROM public.panic_alerts
  WHERE status = 'active';

  SELECT COUNT(*)::int INTO v_stale
  FROM public.live_locations
  WHERE is_active = true
    AND user_type = 'driver'
    AND "timestamp" <= now() - interval '2 minutes';

  SELECT COUNT(*)::int INTO v_active_trips
  FROM public.trip_sessions
  WHERE status = 'active';

  RETURN jsonb_build_object(
    'open_panic_alerts', v_panic,
    'stale_active_buses', v_stale,
    'active_trip_sessions', v_active_trips
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_operational_alerts(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_admin_operational_alerts(uuid) TO authenticated;
