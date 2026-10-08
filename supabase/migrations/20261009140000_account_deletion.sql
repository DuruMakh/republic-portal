-- Account deletion (spec docs/superpowers/specs/2026-10-08-account-deletion-design.md,
-- ADR-047). Additive for the code on main: one vote per member still holds (now a unique
-- constraint instead of the primary key), the audit log still refuses every client write,
-- and nothing on main calls the new functions.

-- 1. A deleted member's poll votes keep counting, with no person attached (spec §4.1).
alter table public.poll_votes drop constraint poll_votes_pkey;
alter table public.poll_votes add column id bigserial;
alter table public.poll_votes add constraint poll_votes_pkey primary key (id);
alter table public.poll_votes alter column member_id drop not null;
alter table public.poll_votes drop constraint poll_votes_member_id_fkey;
alter table public.poll_votes add constraint poll_votes_member_id_fkey
  foreign key (member_id) references public.profiles(id) on delete set null;
-- THE one-vote-per-member rule (community spec §4) now lives here; nulls never collide.
alter table public.poll_votes
  add constraint poll_votes_one_per_member unique (poll_id, member_id);

-- The results members see counted a vote through its member_id, which an anonymous vote no
-- longer has (spec §4.1 assumed the results views count rows; this one counted the member).
-- Same query otherwise: the columns are unchanged, so the grants and the owner-executed
-- definer style carry over untouched, and with no null member_id yet the numbers are equal.
create or replace view public.poll_option_counts as
select po.poll_id, po.id as option_id, count(v.option_id)::int as votes
from public.poll_options po
join public.polls p on p.id = po.poll_id
left join public.poll_votes v on v.poll_id = po.poll_id and v.option_id = po.id
where p.status in ('open', 'closed')
  and public.is_completed_member()
  and (p.status = 'closed'
       or exists (select 1 from public.poll_votes mine
                  where mine.poll_id = po.poll_id and mine.member_id = auth.uid()))
group by po.poll_id, po.id;

-- 2. Members moved to the central movement because their delegate left (spec §3.2).
alter table public.memberships add column note text
  constraint memberships_note_known check (note in ('delegate_left'));

-- 3. Append-only, except the erasure scrub (spec §4.3). Clients hold no privilege on
--    audit_log at all, so this branch is reachable only from erase_account().
create or replace function public.audit_log_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and current_setting('app.erasing', true) = 'on'
     and new.id = old.id
     and new.actor_id is not distinct from old.actor_id
     and new.action = old.action
     and new.target_type = old.target_type
     and new.target_id is not distinct from old.target_id
     and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'audit_log is append-only';
end $$;

-- 4. The erasure itself (spec §2, §4.4). One transaction; deleting the auth user cascades
--    to profiles and from there to memberships, delegates, payments, RSVPs, admin roles and
--    phone proofs; votes are set null.
create function public.erase_account(p_user_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_photo_url text;
  v_team uuid[];
  v_personal_keys constant text[] :=
    array['name', 'memberName', 'firstName', 'lastName', 'personalId', 'phone', 'email'];
begin
  if p_user_id is null
     or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'invalid_target';
  end if;
  if exists (select 1 from public.admin_roles where user_id = p_user_id) then
    raise exception 'staff_account';
  end if;

  select photo_url into v_photo_url from public.delegates where id = p_user_id;

  -- the delegate's team moves to the central movement, marked for the cabinet note
  select coalesce(array_agg(member_id), '{}') into v_team
    from public.memberships where delegate_id = p_user_id and ended_at is null;
  update public.memberships set ended_at = now()
   where delegate_id = p_user_id and ended_at is null;
  insert into public.memberships (member_id, delegate_id, note)
    select unnest(v_team), null::uuid, 'delegate_left';
  -- history rows that still name the delegate lose the link (the FK would block the delete)
  update public.memberships set delegate_id = null where delegate_id = p_user_id;

  -- Audit rows about the person keep the action and lose the personal details. Every
  -- `insert into public.audit_log` in supabase/migrations was re-read for this (2026-10-08).
  -- Personal names are stored under:
  --   name        delegate.approve / reject / update_profile, admin.grant_role / revoke_role
  --               (target_id = the person)
  --   memberName  member.reassign, member.reveal_personal_id, delegate.reveal_personal_id
  --               (target_id = the person) and payment.record / payment.void (target_id is the
  --               PAYMENT; details.memberId is the person)
  --   fromName / toName   member.reassign names a DELEGATE inside another member's row, next to
  --               fromDelegateId / toDelegateId
  --   from / to   delegate.update_name: the delegate's old and new name
  -- No other audit action stores a person's name (news, event, poll, settings, export and
  -- sweep rows carry titles, counts and filters; member.personal_id_conflict has no details).
  perform set_config('app.erasing', 'on', true);
  update public.audit_log
     set details = (details - v_personal_keys) || jsonb_build_object('erased', true)
   where (target_id = p_user_id::text or details ->> 'memberId' = p_user_id::text)
     and details ?| v_personal_keys;
  update public.audit_log
     set details = (details - array['from', 'to']) || jsonb_build_object('erased', true)
   where target_id = p_user_id::text
     and action = 'delegate.update_name';
  update public.audit_log
     set details = (details - 'fromName') || jsonb_build_object('erased', true)
   where action = 'member.reassign'
     and details ->> 'fromDelegateId' = p_user_id::text;
  update public.audit_log
     set details = (details - 'toName') || jsonb_build_object('erased', true)
   where action = 'member.reassign'
     and details ->> 'toDelegateId' = p_user_id::text;
  perform set_config('app.erasing', 'off', true);

  delete from auth.users where id = p_user_id;
  return jsonb_build_object('photoUrl', v_photo_url);
exception
  when foreign_key_violation then
    -- recorded payments, approvals, settings or audit rows as staff: keep the trail intact
    raise exception 'staff_history';
end $$;
revoke execute on function public.erase_account(uuid) from public, anon, authenticated;

create function public.delete_my_account(p_confirm text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_confirm is distinct from 'წაშლა' then raise exception 'invalid_confirmation'; end if;
  return public.erase_account(v_uid);
end $$;
grant execute on function public.delete_my_account(text) to authenticated;
revoke execute on function public.delete_my_account(text) from public, anon;

create function public.admin_delete_member(p_user_id uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''), E' \t\r\n');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_admin_role('super_admin') then raise exception 'missing_role'; end if;
  if length(v_reason) not between 5 and 300 then raise exception 'invalid_reason'; end if;
  if p_user_id is null then raise exception 'invalid_target'; end if;
  if p_user_id = v_uid then raise exception 'cannot_delete_self'; end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'member.delete', 'profile', p_user_id::text,
          jsonb_build_object('reason', v_reason));
  return public.erase_account(p_user_id);
end $$;
grant execute on function public.admin_delete_member(uuid, text) to authenticated;
revoke execute on function public.admin_delete_member(uuid, text) from public, anon;
