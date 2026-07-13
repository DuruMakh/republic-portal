-- Enums
create type member_status as enum ('draft', 'profile_completed', 'active_member');
create type delegate_status as enum ('pending', 'approved', 'rejected');

-- Reference data
create table regions (
  id serial primary key,
  name_ka text not null unique
);
create table cities (
  id serial primary key,
  region_id int not null references regions(id),
  name_ka text not null,
  unique (region_id, name_ka)
);

-- People
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  phone text unique,
  personal_id text unique check (personal_id ~ '^\d{11}$'),
  birth_date date,
  region_id int references regions(id),
  city_id int references cities(id),
  employment text,
  status member_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table delegates (
  id uuid primary key references profiles(id) on delete cascade,
  status delegate_status not null default 'pending',
  referral_code text not null unique,
  bio text,
  photo_url text,
  tc_accepted_at timestamptz not null,
  verified_at timestamptz,
  verified_by uuid references profiles(id)
);

create table memberships (
  id bigserial primary key,
  member_id uuid not null references profiles(id) on delete cascade,
  delegate_id uuid references delegates(id),  -- null = "ცენტრალური მოძრაობა"
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index one_active_membership on memberships (member_id) where ended_at is null;

create table payments (
  id bigserial primary key,
  member_id uuid not null references profiles(id),
  amount_gel numeric(10,2) not null check (amount_gel > 0),
  paid_at date not null,
  bank_reference text,
  source text not null default 'manual',
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table admin_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('super_admin', 'verifier', 'finance', 'editor')),
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Append-only audit log
create table audit_log (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create function audit_log_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_immutable();

-- updated_at maintenance
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Server-managed profile columns: the "own profile updatable" RLS policy below lets a
-- member update their own row, but status, personal_id, phone and id must only change
-- through server-side flows. Client API roles are blocked at trigger level; service-role
-- and postgres paths pass the role check and stay unrestricted.
create function protect_profile_columns() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated')
    and (new.status is distinct from old.status
      or new.personal_id is distinct from old.personal_id
      or new.phone is distinct from old.phone
      or new.id is distinct from old.id)
  then
    raise exception 'profiles.status, personal_id, phone and id are server-managed';
  end if;
  return new;
end $$;
create trigger profiles_protect_columns before update on profiles
  for each row execute function protect_profile_columns();

-- Dev OTP delivery (Send-SMS auth hook writes here in dev/staging)
create table dev_otp_inbox (
  id bigserial primary key,
  phone text not null,
  otp text not null,
  created_at timestamptz not null default now()
);

-- Payload shape verified 2026-07-12 against
-- https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
-- event = { "user": { "phone": "+1333363128", ... }, "sms": { "otp": "561166" } }
-- matches event->'user'->>'phone' / event->'sms'->>'otp' below; no adjustment needed.
create function public.send_sms_hook(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.dev_otp_inbox (phone, otp)
  values (event->'user'->>'phone', event->'sms'->>'otp');
  return '{}'::jsonb;
end $$;
-- The grants below are the load-bearing access path: supabase_auth_admin invokes the hook.
grant execute on function public.send_sms_hook to supabase_auth_admin;
revoke execute on function public.send_sms_hook from authenticated, anon, public;
grant insert on dev_otp_inbox to supabase_auth_admin;
grant usage, select on sequence dev_otp_inbox_id_seq to supabase_auth_admin;

-- RLS: enabled everywhere; minimal Phase-0 policies (admin flows get policies in Phase 4)
alter table regions enable row level security;
alter table cities enable row level security;
alter table profiles enable row level security;
alter table delegates enable row level security;
alter table memberships enable row level security;
alter table payments enable row level security;
alter table admin_roles enable row level security;
alter table audit_log enable row level security;
alter table dev_otp_inbox enable row level security;

create policy "regions readable by all" on regions for select using (true);
create policy "cities readable by all" on cities for select using (true);
create policy "approved delegates are public" on delegates for select using (status = 'approved');
create policy "own profile readable" on profiles for select using (auth.uid() = id);
create policy "own profile updatable" on profiles for update using (auth.uid() = id);
create policy "own memberships readable" on memberships for select using (auth.uid() = member_id);
create policy "own payments readable" on payments for select using (auth.uid() = member_id);
-- audit_log, admin_roles, dev_otp_inbox: no client policies (service-role/hook only)

-- Explicit Data API grants. New entities in `public` are no longer auto-exposed to the
-- API roles (legacy auto-expose is deprecated, removed 2026-10-30); without these grants
-- the RLS policies above would be unreachable (42501). Grants do not widen RLS — e.g.
-- delegates stays constrained to approved rows by its policy.
grant select on regions, cities, delegates to anon, authenticated;
grant select, update on profiles to authenticated;
grant select on memberships, payments to authenticated;
-- admin_roles, audit_log, dev_otp_inbox: no client grants (server-side only)
