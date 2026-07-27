-- Security check-up fix wave (Task 12), fix 4 of 5 — finding F14 / LB-7.
--
-- THE ASYMMETRY IS THE FINDING. 20260722140000 fix #3 deliberately narrowed
-- member_change_delegate's delegates-row guard to `status = 'approved'`, on the
-- correct reasoning that only an APPROVED delegate holds no membership and that
-- R2 keeps a pending/rejected requester's member life untouched (spec §3.1).
-- The MIRROR guard in admin_reassign_member (20260717150000_admin_crm.sql:666)
-- was not narrowed with it. So one self-service, un-audited call to
-- request_delegacy() left the caller free to keep changing their own delegate
-- binding while permanently removing the verifier's ability to change it —
-- and it is irreversible: admin_reject_delegate never deletes the row, and no
-- statement anywhere in the schema deletes from delegates.
--
-- Reproduced live before this migration, through the real gate (a super_admin's
-- identity reproduced the way PostgREST reproduces it): reassigning a
-- pending-status requester was refused `invalid_target`. Six completed members
-- are already in that state on staging, all reached accidentally.
--
-- The guard narrows to match its mirror, and nothing else changes: an APPROVED
-- delegate still cannot be reassigned, because approval closes their own
-- membership and delegates back no one (ADR-013). The function keeps refusing a
-- member with no open membership rather than self-healing one, and it keeps
-- writing its member.reassign row to audit_log in the same transaction.
--
-- Body otherwise identical to 20260717150000_admin_crm.sql. ACLs survive
-- create-or-replace; grants restated verbatim per house shape.
create or replace function admin_reassign_member(p_member_id uuid, p_delegate_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_target uuid;
  v_open_delegate uuid;
  v_has_open boolean := false;
  v_from_name text;
  v_to_name text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  select * into v_profile from public.profiles where id = p_member_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_profile.registration_completed_at is null and v_profile.status <> 'active_member' then
    raise exception 'invalid_target';
  end if;
  if exists (select 1 from public.delegates d where d.id = p_member_id and d.status = 'approved') then
    raise exception 'invalid_target'; -- APPROVED delegates hold no membership (ADR-013);
                                      -- pending/rejected requesters still do (spec §3.1),
                                      -- and stay reassignable, exactly as member_change_delegate
                                      -- lets them change it themselves (20260722140000 fix #3).
  end if;
  select d.id into v_target from public.delegates d
    where d.id = p_delegate_id and d.status = 'approved';
  if v_target is null then raise exception 'invalid_delegate'; end if;

  select m.delegate_id, true into v_open_delegate, v_has_open
    from public.memberships m where m.member_id = p_member_id and m.ended_at is null;

  if not coalesce(v_has_open, false) then
    -- spec §4.5 precondition: completed members always hold an open membership row
    -- (possibly with delegate_id null = ცენტრალური მოძრაობა, ADR-013); a missing
    -- row means this member is not reassignable — refuse rather than self-heal.
    raise exception 'invalid_target';
  end if;
  if v_open_delegate = v_target then
    return; -- same target: friendly no-op, no history row, no audit noise
  end if;

  update public.memberships set ended_at = now()
    where member_id = p_member_id and ended_at is null;
  insert into public.memberships (member_id, delegate_id) values (p_member_id, v_target);

  select case when v_open_delegate is null then 'ცენტრალური მოძრაობა'
              else (select pr.first_name || ' ' || pr.last_name
                      from public.profiles pr where pr.id = v_open_delegate) end
    into v_from_name;
  select pr.first_name || ' ' || pr.last_name into v_to_name
    from public.profiles pr where pr.id = v_target;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'member.reassign', 'profile', p_member_id::text,
          jsonb_build_object(
            'memberName', v_profile.first_name || ' ' || v_profile.last_name,
            'fromDelegateId', v_open_delegate, 'fromName', v_from_name,
            'toDelegateId', v_target, 'toName', v_to_name));
end $$;

grant execute on function admin_reassign_member(uuid, uuid) to authenticated;
revoke execute on function admin_reassign_member(uuid, uuid) from public, anon;
