-- Phase 6 R2 fix: whitespace-aware trim in the body/description guards +
-- length constraints introduced by 20260722120000_r2_ladder_and_numbers.sql.
-- btrim() default strips spaces only -- this recreates the R2 guards with an
-- explicit whitespace set.
-- 20260722120000 stays frozen (applied migrations are never edited); this is
-- a new migration on top of it, per house policy.

create or replace function admin_save_event(
  p_id uuid, p_title text, p_description text, p_location text,
  p_starts_at timestamptz, p_ends_at timestamptz
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''), E' \t\r\n');
  v_description text := coalesce(p_description, '');
  v_location text := btrim(coalesce(p_location, ''), E' \t\r\n');
  v_row public.events%rowtype;
  v_action text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  if char_length(v_title) not between 1 and 160 then raise exception 'invalid_title'; end if;
  if char_length(v_description) > 20000
     or char_length(btrim(v_description, E' \t\r\n')) < 1 then
    raise exception 'invalid_body';
  end if;
  if char_length(v_location) not between 1 and 200 then raise exception 'invalid_location'; end if;
  if p_starts_at is null or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'invalid_event_dates';
  end if;

  if p_id is null then
    insert into public.events (title, description, location, starts_at, ends_at, created_by)
    values (v_title, v_description, v_location, p_starts_at, p_ends_at, v_uid)
    returning * into v_row;
    v_action := 'event.save';
  else
    select * into v_row from public.events where id = p_id;
    if not found then raise exception 'invalid_target'; end if;
    -- cancelled events are frozen history (only draft/published are editable)
    if v_row.status = 'cancelled' then raise exception 'invalid_status'; end if;
    v_action := case when v_row.status = 'published' then 'event.update' else 'event.save' end;
    update public.events
    set title = v_title, description = v_description, location = v_location,
        starts_at = p_starts_at, ends_at = p_ends_at
    where id = p_id and status <> 'cancelled'
    returning * into v_row;
    -- conditional DML: a cancel that lands between the check and this UPDATE
    -- now yields zero rows instead of silently editing frozen history
    if not found then raise exception 'invalid_status'; end if;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, v_action, 'event', v_row.id::text,
          jsonb_build_object('title', v_title, 'startsAt', p_starts_at,
                             'status', v_row.status));
  return v_row.id;
end $$;

grant execute on function admin_save_event(uuid, text, text, text, timestamptz, timestamptz) to authenticated;
revoke execute on function admin_save_event(uuid, text, text, text, timestamptz, timestamptz) from public, anon;

create or replace function admin_save_news(p_id uuid, p_title text, p_body text, p_visibility text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''), E' \t\r\n');
  v_body text := coalesce(p_body, '');
  v_row public.news%rowtype;
  v_action text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  if char_length(v_title) not between 1 and 160 then raise exception 'invalid_title'; end if;
  if char_length(v_body) > 20000 or char_length(btrim(v_body, E' \t\r\n')) < 1 then
    raise exception 'invalid_body';
  end if;
  if p_visibility not in ('public', 'members') then raise exception 'invalid_visibility'; end if;

  if p_id is null then
    insert into public.news (title, body, visibility, created_by)
    values (v_title, v_body, p_visibility, v_uid)
    returning * into v_row;
    v_action := 'news.save';
  else
    select * into v_row from public.news where id = p_id;
    if not found then raise exception 'invalid_target'; end if;
    v_action := case when v_row.status = 'published' then 'news.update' else 'news.save' end;
    update public.news
    set title = v_title, body = v_body, visibility = p_visibility
    where id = p_id
    returning * into v_row;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, v_action, 'news', v_row.id::text,
          jsonb_build_object('title', v_title, 'visibility', p_visibility,
                             'status', v_row.status));
  return v_row.id;
end $$;

grant execute on function admin_save_news(uuid, text, text, text) to authenticated;
revoke execute on function admin_save_news(uuid, text, text, text) from public, anon;

-- Same explicit whitespace set at the table-constraint backstop (9c in
-- 20260722120000), exact bounds unchanged (<= 20000, >= 1).
alter table news drop constraint news_body_len;
alter table news add constraint news_body_len
  check (char_length(body) <= 20000 and char_length(btrim(body, E' \t\r\n')) >= 1);
alter table events drop constraint events_description_len;
alter table events add constraint events_description_len
  check (char_length(description) <= 20000 and char_length(btrim(description, E' \t\r\n')) >= 1);
