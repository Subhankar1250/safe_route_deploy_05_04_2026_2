create table if not exists public.guardian_notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  student_pickup boolean not null default true,
  reach_school boolean not null default true,
  leave_school boolean not null default true,
  student_drop boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guardian_notification_preferences enable row level security;

drop policy if exists "Guardians can view own notification prefs" on public.guardian_notification_preferences;
create policy "Guardians can view own notification prefs"
on public.guardian_notification_preferences
for select
using (auth.uid() = profile_id);

drop policy if exists "Guardians can update own notification prefs" on public.guardian_notification_preferences;
create policy "Guardians can update own notification prefs"
on public.guardian_notification_preferences
for all
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop trigger if exists update_guardian_notification_preferences_updated_at on public.guardian_notification_preferences;
create trigger update_guardian_notification_preferences_updated_at
before update on public.guardian_notification_preferences
for each row execute function public.update_updated_at_column();

