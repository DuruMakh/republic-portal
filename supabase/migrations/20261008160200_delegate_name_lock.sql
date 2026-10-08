-- Security audit 2026-10-08, M2: an approved delegate could rename themselves after vetting,
-- straight onto the public page and unaudited (profiles.first_name/last_name are client-writable
-- and public_delegates shows them). Names of approved delegates now change only through
-- admin_update_delegate_name() — super_admin/verifier, audited. Decision D3.

-- Clients cannot SELECT delegates (20260713175043), and the trigger must run as the invoker so
-- current_user still tells clients apart. The approval check is therefore a definer helper,
-- keyed on the caller (a client only ever updates its own profile row: "own profile updatable").
create function is_approved_delegate() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.delegates d
    where d.id = auth.uid() and d.status = 'approved'
  );
$$;
revoke execute on function is_approved_delegate() from public, anon;
grant execute on function is_approved_delegate() to authenticated;

-- protect_profile_columns(): restates the LIVE body (20261008140000_registration_privacy_consent.sql)
-- verbatim, plus the name-lock block.
create or replace function protect_profile_columns() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.status is distinct from old.status
      or new.personal_id is distinct from old.personal_id
      or new.phone is distinct from old.phone
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at
      or new.signup_ref_code is distinct from old.signup_ref_code
      or new.membership_tier is distinct from old.membership_tier
      or new.reference_code is distinct from old.reference_code
      or new.registration_completed_at is distinct from old.registration_completed_at
      or new.pending_delegate_id is distinct from old.pending_delegate_id
      or new.referral_code is distinct from old.referral_code
      or new.privacy_accepted_at is distinct from old.privacy_accepted_at
      or new.privacy_version is distinct from old.privacy_version
    then
      raise exception 'server-managed profile columns cannot be changed by client roles';
    end if;
    -- Security audit M2: an approved delegate's public name changes only through an admin.
    if (new.first_name is distinct from old.first_name
        or new.last_name is distinct from old.last_name)
       and public.is_approved_delegate() then
      raise exception 'name_locked';
    end if;
    -- Phase 3 hardening rider — keep: value rules on direct client PATCHes
    if new.first_name is distinct from old.first_name
       and length(btrim(coalesce(new.first_name, ''))) not between 1 and 60 then
      raise exception 'invalid_name';
    end if;
    if new.last_name is distinct from old.last_name
       and length(btrim(coalesce(new.last_name, ''))) not between 1 and 60 then
      raise exception 'invalid_name';
    end if;
    if new.employment is distinct from old.employment
       and length(btrim(coalesce(new.employment, ''))) not between 1 and 100 then
      raise exception 'invalid_employment';
    end if;
  end if;
  return new;
end $$;

-- The admin correction path. Its own UPDATE runs as the definer, so current_user is not a
-- client role and the lock above does not apply to it.
create function admin_update_delegate_name(
  p_delegate_id uuid, p_first_name text, p_last_name text
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_first text := btrim(coalesce(p_first_name, ''), E' \t\r\n');
  v_last text := btrim(coalesce(p_last_name, ''), E' \t\r\n');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  if length(v_first) not between 1 and 60 or length(v_last) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  if not exists (
    select 1 from public.delegates d where d.id = p_delegate_id and d.status = 'approved'
  ) then
    raise exception 'invalid_target';
  end if;
  select * into v_profile from public.profiles where id = p_delegate_id;

  update public.profiles set first_name = v_first, last_name = v_last where id = p_delegate_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.update_name', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'from', v_profile.first_name || ' ' || v_profile.last_name,
            'to', v_first || ' ' || v_last));
end $$;
revoke execute on function admin_update_delegate_name(uuid, text, text) from public, anon;
grant execute on function admin_update_delegate_name(uuid, text, text) to authenticated;
