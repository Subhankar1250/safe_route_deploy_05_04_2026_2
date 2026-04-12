-- Guardian quiet hours (IST) for push delivery; admin bus freshness; notification retention.

ALTER TABLE public.guardian_notification_preferences
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_start_ist text NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_end_ist text NOT NULL DEFAULT '06:00';

COMMENT ON COLUMN public.guardian_notification_preferences.quiet_start_ist IS '24h HH:MM, Asia/Kolkata';
COMMENT ON COLUMN public.guardian_notification_preferences.quiet_end_ist IS '24h HH:MM, Asia/Kolkata';

-- Live driver pings: fresh vs stale (for admin overview).
CREATE OR REPLACE FUNCTION public.get_admin_bus_location_health(p_admin_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fresh int := 0;
  v_stale int := 0;
  v_inactive int := 0;
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

  SELECT COUNT(*)::int INTO v_fresh
  FROM public.live_locations
  WHERE is_active = true
    AND user_type = 'driver'
    AND "timestamp" > now() - interval '2 minutes';

  SELECT COUNT(*)::int INTO v_stale
  FROM public.live_locations
  WHERE is_active = true
    AND user_type = 'driver'
    AND "timestamp" <= now() - interval '2 minutes';

  SELECT COUNT(*)::int INTO v_inactive
  FROM public.live_locations
  WHERE is_active = false AND user_type = 'driver';

  RETURN jsonb_build_object(
    'fresh_last_2m', v_fresh,
    'stale_active', v_stale,
    'inactive_rows', v_inactive
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_bus_location_health(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_admin_bus_location_health(uuid) TO authenticated;

-- Purge old in-app guardian notifications (run from admin panel or cron via service role).
CREATE OR REPLACE FUNCTION public.admin_purge_old_guardian_notifications(
  p_admin_profile_id uuid,
  p_days int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int := 0;
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

  IF p_days IS NULL OR p_days < 7 OR p_days > 730 THEN
    RAISE EXCEPTION 'p_days must be between 7 and 730' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.guardian_notifications
  WHERE created_at < now() - (p_days::text || ' days')::interval;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_purge_old_guardian_notifications(uuid, int) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_purge_old_guardian_notifications(uuid, int) TO authenticated;
