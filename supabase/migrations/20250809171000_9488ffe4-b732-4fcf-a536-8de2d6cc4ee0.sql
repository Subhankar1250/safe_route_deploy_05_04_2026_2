-- Create/refresh admin profiles for the specified users without relying on
-- a UNIQUE constraint on profiles.email (some environments don't have one).

-- 1) Update existing rows (matched by email).
UPDATE profiles
SET
  username = v.username,
  user_type = 'admin',
  mobile_number = v.mobile_number,
  updated_at = now()
FROM (
  VALUES
    ('subhankar.ghorui1995@gmail.com', 'Subhankar Ghorui', '+919735750941', 'admin_subhankar'),
    ('ranajit.sasmal@gmail.com', 'Ranajit Sasmal', '+919733594162', 'admin_ranajit')
) AS v(email, username, mobile_number, firebase_uid)
WHERE profiles.email = v.email;

-- 2) Insert missing rows.
INSERT INTO profiles (id, firebase_uid, email, username, user_type, mobile_number, created_at, updated_at)
SELECT
  gen_random_uuid(),
  v.firebase_uid,
  v.email,
  v.username,
  'admin',
  v.mobile_number,
  now(),
  now()
FROM (
  VALUES
    ('subhankar.ghorui1995@gmail.com', 'Subhankar Ghorui', '+919735750941', 'admin_subhankar'),
    ('ranajit.sasmal@gmail.com', 'Ranajit Sasmal', '+919733594162', 'admin_ranajit')
) AS v(email, username, mobile_number, firebase_uid)
WHERE NOT EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.email = v.email
);