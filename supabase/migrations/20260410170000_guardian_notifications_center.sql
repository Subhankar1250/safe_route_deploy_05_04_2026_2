create table if not exists public.guardian_notifications (
  id uuid primary key default gen_random_uuid(),
  guardian_profile_id uuid not null references public.profiles(id) on delete cascade,
  driver_id uuid null references public.drivers(id) on delete set null,
  student_id uuid null references public.students(id) on delete set null,
  event_step text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists idx_guardian_notifications_guardian_created
on public.guardian_notifications (guardian_profile_id, created_at desc);

alter table public.guardian_notifications enable row level security;

drop policy if exists "Guardians can view own notifications" on public.guardian_notifications;
create policy "Guardians can view own notifications"
on public.guardian_notifications
for select
using (auth.uid() = guardian_profile_id);

drop policy if exists "Guardians can update own notifications read" on public.guardian_notifications;
create policy "Guardians can update own notifications read"
on public.guardian_notifications
for update
using (auth.uid() = guardian_profile_id)
with check (auth.uid() = guardian_profile_id);

