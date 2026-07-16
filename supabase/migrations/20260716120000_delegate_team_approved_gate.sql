-- Phase 3 rider: delegate_team() is approved-delegates-only at the DB boundary
-- (the /delegate/team page gate is UX; CodeRabbit PR#4 review finding).
-- delegate_panel() intentionally stays any-status — pending/rejected delegates
-- need their own status + counts for the panel's explainer states.
create or replace function delegate_team() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_team jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.delegates d where d.id = v_uid) then
    raise exception 'not_a_delegate';
  end if;
  if not exists (
    select 1 from public.delegates d where d.id = v_uid and d.status = 'approved'
  ) then
    raise exception 'not_approved'; -- unreachable via UI (page redirects pre-approval)
  end if;

  select coalesce(
      jsonb_agg(jsonb_build_object(
        'firstName', p.first_name,
        'lastName', p.last_name,
        'registeredAt', p.created_at,
        'status', p.status::text
      ) order by p.created_at desc),
      '[]'::jsonb)
    into v_team
    from public.memberships m
    join public.profiles p on p.id = m.member_id
    where m.delegate_id = v_uid and m.ended_at is null;

  return v_team;
end $$;
-- create or replace preserves the existing ACLs (authenticated-only)
