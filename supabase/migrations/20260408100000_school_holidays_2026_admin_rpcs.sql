-- 2026 school holiday calendar (tagged for idempotent re-seed), public holiday reads for anon users,
-- admin holiday CRUD via SECURITY DEFINER (works with mobile/localStorage admin login),
-- and create_admin_by_admin for the same login model.

-- ---------------------------------------------------------------------------
-- Holiday schedule: let guardians/drivers read without JWT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "All authenticated users can view holidays" ON public.holiday_schedule;
DROP POLICY IF EXISTS "Public can view holiday schedule" ON public.holiday_schedule;

CREATE POLICY "Public can view holiday schedule"
  ON public.holiday_schedule
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Re-seed 2026 list (matches published calendar; lunar/Islamic dates per school notice)
-- ---------------------------------------------------------------------------
DELETE FROM public.holiday_schedule
WHERE description LIKE '%[2026-school-calendar]%';

INSERT INTO public.holiday_schedule (
  name, description, start_date, end_date, is_recurring, affects_routes, created_by
) VALUES
(
  'New Year''s Day',
  'National holiday. [2026-school-calendar]',
  '2026-01-01', '2026-01-01', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Makar Sankranti',
  'Traditional festival. [2026-school-calendar]',
  '2026-01-14', '2026-01-14', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Shab-e-Barat',
  'Islamic observance (confirm locally). [2026-school-calendar]',
  '2026-02-04', '2026-02-04', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Dol Yatra',
  'Holi / Dol celebration. [2026-school-calendar]',
  '2026-03-03', '2026-03-03', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Good Friday',
  'Christian holiday. [2026-school-calendar]',
  '2026-04-03', '2026-04-03', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Charak',
  'Traditional Bengali festival. [2026-school-calendar]',
  '2026-04-14', '2026-04-14', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Bengali New Year''s Day',
  'Poila Boishakh. [2026-school-calendar]',
  '2026-04-15', '2026-04-15', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'May Day',
  'International Workers'' Day. [2026-school-calendar]',
  '2026-05-01', '2026-05-01', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Summer Vacation',
  'According to local weather — adjust dates when announced. N.B. Holidays may change due to local festivals or other reasons. [2026-school-calendar]',
  '2026-05-16', '2026-06-30', false, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'ID-UZ-Zuha',
  'Eid al-Adha (confirm locally). [2026-school-calendar]',
  '2026-05-27', '2026-05-27', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Muharram / Ashura',
  'Islamic observance (confirm locally). [2026-school-calendar]',
  '2026-06-26', '2026-06-26', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Ratha Yatra',
  'Jagannath Rath Yatra. [2026-school-calendar]',
  '2026-07-16', '2026-07-16', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Rainy Vacation',
  'According to local weather — adjust dates when announced. [2026-school-calendar]',
  '2026-07-20', '2026-08-15', false, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Janmashtami',
  'Birth of Lord Krishna (confirm locally). [2026-school-calendar]',
  '2026-09-04', '2026-09-04', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Biswakarma Puja',
  'Hindu festival. [2026-school-calendar]',
  '2026-09-18', '2026-09-18', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Gandhi Jayanti',
  'National holiday. [2026-school-calendar]',
  '2026-10-02', '2026-10-02', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Durga Puja',
  'Major festival — inclusive range per school notice. [2026-school-calendar]',
  '2026-10-19', '2026-10-23', false, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Kalipuja and Bhatridwitiya',
  'Per school notice. [2026-school-calendar]',
  '2026-11-09', '2026-11-11', false, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Guru Nanak''s Birthday',
  'Guru Nanak Jayanti. [2026-school-calendar]',
  '2026-11-24', '2026-11-24', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
),
(
  'Christmas Day',
  'Christmas. [2026-school-calendar]',
  '2026-12-25', '2026-12-25', true, true,
  (SELECT id FROM public.profiles WHERE user_type = 'admin' ORDER BY created_at LIMIT 1)
);

-- ---------------------------------------------------------------------------
-- Today banner: prefer exact match; grant for anon
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_today_holiday_status()
RETURNS TABLE(
  is_holiday boolean,
  is_weekend boolean,
  holiday_name text,
  holiday_message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_date date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;
  today_dow integer := EXTRACT(DOW FROM today_date);
  holiday_info record;
BEGIN
  is_weekend := (today_dow = 0 OR today_dow = 6);

  SELECT h.name, h.description INTO holiday_info
  FROM public.holiday_schedule h
  WHERE today_date BETWEEN h.start_date AND h.end_date
  ORDER BY h.start_date DESC, h.name
  LIMIT 1;

  is_holiday := (holiday_info.name IS NOT NULL);
  holiday_name := holiday_info.name;

  IF is_holiday AND is_weekend THEN
    holiday_message := 'Today is ' || holiday_name || ' and it''s also a weekend. No school bus service today.';
  ELSIF is_holiday THEN
    holiday_message := 'Today is ' || holiday_name || '. No school bus service today.';
  ELSIF is_weekend THEN
    holiday_message := 'Today is a weekend. No school bus service today.';
  ELSE
    holiday_message := NULL;
  END IF;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_today_holiday_status() TO anon;
GRANT EXECUTE ON FUNCTION public.get_today_holiday_status() TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin holiday management (p_actor = profiles.id from localStorage session)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_holidays(p_actor uuid)
RETURNS SETOF public.holiday_schedule
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor AND user_type IN ('admin', 'guardian_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT h.*
  FROM public.holiday_schedule h
  ORDER BY h.start_date ASC, h.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_insert_holiday(
  p_actor uuid,
  p_name text,
  p_description text,
  p_start_date date,
  p_end_date date,
  p_is_recurring boolean DEFAULT false,
  p_affects_routes boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor AND user_type IN ('admin', 'guardian_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'name required';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'end_date before start_date';
  END IF;

  INSERT INTO public.holiday_schedule (
    name, description, start_date, end_date, is_recurring, affects_routes, created_by
  ) VALUES (
    trim(p_name),
    nullif(trim(p_description), ''),
    p_start_date,
    p_end_date,
    COALESCE(p_is_recurring, false),
    COALESCE(p_affects_routes, true),
    p_actor
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_holiday(p_actor uuid, p_holiday_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor AND user_type IN ('admin', 'guardian_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.holiday_schedule WHERE id = p_holiday_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_holidays(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_list_holidays(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_insert_holiday(uuid, text, text, date, date, boolean, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_insert_holiday(uuid, text, text, date, date, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_holiday(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_holiday(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Add admin without Supabase Auth (mobile login)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_admin_by_admin(
  p_actor uuid,
  p_mobile text,
  p_username text,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm text;
  new_id uuid;
  em text;
  uname text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor AND user_type = 'admin'
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  norm := right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
  IF length(norm) <> 10 THEN
    RAISE EXCEPTION 'invalid mobile: need 10 digits';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE right(regexp_replace(coalesce(mobile_number, ''), '\D', '', 'g'), 10) = norm
  ) THEN
    RAISE EXCEPTION 'mobile already registered';
  END IF;

  uname := trim(coalesce(p_username, ''));
  IF uname = '' THEN
    RAISE EXCEPTION 'name required';
  END IF;

  IF length(uname) > 80 THEN
    uname := left(uname, 80);
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(uname)) THEN
    uname := uname || '_' || norm;
  END IF;

  em := coalesce(nullif(trim(p_email), ''), norm || '.admin@sishutirtha.local');

  INSERT INTO public.profiles (firebase_uid, email, username, user_type, mobile_number)
  VALUES (
    'admin_mobile_' || norm || '_' || gen_random_uuid()::text,
    em,
    uname,
    'admin',
    norm
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_admin_by_admin(uuid, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_admin_by_admin(uuid, text, text, text) TO authenticated;
