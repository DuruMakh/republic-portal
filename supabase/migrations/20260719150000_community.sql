-- Phase 5 — Community (spec §4): news / events / event_rsvps / polls /
-- poll_options / poll_votes; member/public/admin read views; transparency
-- aggregates; audited editor RPCs; member RSVP/vote RPCs; news-images bucket.
-- Access model: base tables carry ZERO client grants; reads go through views,
-- writes through SECURITY DEFINER RPCs (ADR-014; extends ADR-009).

-- 1) Tables ---------------------------------------------------------------------

create table news (
  id uuid primary key default gen_random_uuid(),
  title text not null
    constraint news_title_len check (char_length(btrim(title)) between 1 and 160),
  body text not null
    constraint news_body_len check (char_length(body) between 1 and 20000),
  visibility text not null default 'public'
    constraint news_visibility check (visibility in ('public', 'members')),
  status text not null default 'draft'
    constraint news_status check (status in ('draft', 'published')),
  slug text unique
    constraint news_slug_format
    check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80)),
  image_url text,
  published_at timestamptz,
  -- published rows are complete rows (delegates' approved-slug backstop
  -- precedent): the seed writes status directly, so the RPC path must not be
  -- the only guard
  constraint published_news_complete
    check (status <> 'published' or (slug is not null and published_at is not null)),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger news_updated_at before update on news
  for each row execute function set_updated_at();
create index news_public_list on news (published_at desc) where status = 'published';

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null
    constraint events_title_len check (char_length(btrim(title)) between 1 and 160),
  description text not null
    constraint events_description_len check (char_length(description) between 1 and 20000),
  location text not null
    constraint events_location_len check (char_length(btrim(location)) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz,
  constraint events_dates check (ends_at is null or ends_at > starts_at),
  status text not null default 'draft'
    constraint events_status check (status in ('draft', 'published', 'cancelled')),
  slug text unique
    constraint events_slug_format
    check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80)),
  published_at timestamptz,
  -- cancelled rows stay publicly visible, so they too must keep slug/published_at
  constraint published_events_complete
    check (status = 'draft' or (slug is not null and published_at is not null)),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger events_updated_at before update on events
  for each row execute function set_updated_at();
create index events_public_list on events (starts_at) where status <> 'draft';

-- member_id cascades on profile deletion: e2e/staging cleanup only — the
-- platform has no member-deletion flow (payments.member_id precedent, ADR-015).
create table event_rsvps (
  event_id uuid not null references events(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  status text not null
    constraint event_rsvps_status check (status in ('going', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
create trigger event_rsvps_updated_at before update on event_rsvps
  for each row execute function set_updated_at();

create table polls (
  id uuid primary key default gen_random_uuid(),
  question text not null
    constraint polls_question_len check (char_length(btrim(question)) between 1 and 300),
  status text not null default 'draft'
    constraint polls_status check (status in ('draft', 'open', 'closed')),
  ends_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger polls_updated_at before update on polls
  for each row execute function set_updated_at();

create table poll_options (
  id uuid not null default gen_random_uuid() primary key,
  poll_id uuid not null references polls(id) on delete cascade,
  position int not null,
  label text not null
    constraint poll_options_label_len check (char_length(btrim(label)) between 1 and 120),
  unique (poll_id, id),
  unique (poll_id, position)
);

create table poll_votes (
  poll_id uuid not null references polls(id) on delete cascade,
  option_id uuid not null,
  member_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- THE one-vote-per-member rule (parent spec §4): a second vote is a PK
  -- violation, not an application decision.
  primary key (poll_id, member_id),
  -- a vote can never point at another poll's option
  foreign key (poll_id, option_id) references poll_options (poll_id, id) on delete cascade
);

-- 2) Lockdown -------------------------------------------------------------------

alter table news enable row level security;
alter table events enable row level security;
alter table event_rsvps enable row level security;
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;

revoke all on news, events, event_rsvps, polls, poll_options, poll_votes
  from anon, authenticated;

-- Own-row read-backs (spec §4.2): how the cabinet knows "did I RSVP / vote".
create policy "own rsvps readable" on event_rsvps
  for select to authenticated using (member_id = auth.uid());
grant select (event_id, member_id, status) on event_rsvps to authenticated;

create policy "own votes readable" on poll_votes
  for select to authenticated using (member_id = auth.uid());
grant select (poll_id, option_id, member_id) on poll_votes to authenticated;

-- 3) Member gate helper ----------------------------------------------------------

-- View-callable completed-registration check (the DB-level meaning of
-- „წევრებისთვის"). Definer so it can read profiles regardless of the caller's
-- column grants; callers still need EXECUTE (functions in views run as the
-- calling user — has_any_admin_role precedent). Stamp-only by design (spec
-- §4.2): registration_completed_at, not status.
create function is_completed_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and registration_completed_at is not null
  );
$$;
grant execute on function is_completed_member() to authenticated;
revoke execute on function is_completed_member() from public, anon;

-- 4) Read views (spec §4.2–§4.3) -------------------------------------------------

create view public_news as
select id, slug, title, body, image_url, published_at
from news
where status = 'published' and visibility = 'public';

create view member_news as
select id, slug, title, body, image_url, visibility, published_at
from news
where status = 'published' and is_completed_member();

create view public_events as
select id, slug, title, description, location, starts_at, ends_at, status, published_at
from events
where status in ('published', 'cancelled');

create view member_event_going_counts as
select e.id as event_id,
       count(r.member_id) filter (where r.status = 'going')::int as going
from events e
left join event_rsvps r on r.event_id = e.id
where e.status in ('published', 'cancelled') and is_completed_member()
group by e.id;

create view member_polls as
select id, question, status, ends_at, opened_at, closed_at
from polls
where status in ('open', 'closed') and is_completed_member();

-- Labels are always member-visible (they render the vote buttons); only COUNTS
-- are gated (decision #4) — poll_option_counts below.
create view member_poll_options as
select po.poll_id, po.id as option_id, po.position, po.label
from poll_options po
join polls p on p.id = po.poll_id
where p.status in ('open', 'closed') and is_completed_member();

create view poll_option_counts as
select po.poll_id, po.id as option_id, count(v.member_id)::int as votes
from poll_options po
join polls p on p.id = po.poll_id
left join poll_votes v on v.poll_id = po.poll_id and v.option_id = po.id
where p.status in ('open', 'closed')
  and is_completed_member()
  and (p.status = 'closed'
       or exists (select 1 from poll_votes mine
                  where mine.poll_id = po.poll_id and mine.member_id = auth.uid()))
group by po.poll_id, po.id;

create view transparency_stats as
select
  coalesce((select sum(amount_gel) from payments where voided_at is null), 0)::numeric(12, 2)
    as total_gel,
  (select count(*)::int from profiles where status <> 'draft') as registered_members,
  (select count(*)::int from delegates where status = 'approved') as approved_delegates;

create view transparency_regions as
select r.id as region_id,
       r.name_ka,
       count(p.id) filter (where p.status <> 'draft')::int as registered,
       count(p.id) filter (where p.status = 'active_member')::int as active
from regions r
left join profiles p on p.region_id = r.id
group by r.id, r.name_ka;

create view admin_news as
select n.id, n.title, n.body, n.visibility, n.status, n.slug, n.image_url,
       n.published_at, n.updated_at
from news n
where has_any_admin_role('super_admin', 'editor');

create view admin_events as
select e.id, e.title, e.description, e.location, e.starts_at, e.ends_at, e.status,
       e.slug, e.published_at, e.updated_at,
       (select count(*)::int from event_rsvps r
        where r.event_id = e.id and r.status = 'going') as going_count
from events e
where has_any_admin_role('super_admin', 'editor');

create view admin_polls as
select p.id, p.question, p.status, p.ends_at, p.opened_at, p.closed_at, p.updated_at,
       (select count(*)::int from poll_votes v where v.poll_id = p.id) as total_votes
from polls p
where has_any_admin_role('super_admin', 'editor');

create view admin_poll_options as
select po.poll_id, po.id as option_id, po.position, po.label,
       (select count(*)::int from poll_votes v
        where v.poll_id = po.poll_id and v.option_id = po.id) as votes
from poll_options po
where has_any_admin_role('super_admin', 'editor');

-- Defense-in-depth (portability): on instances with classic default privileges,
-- views are born with ALL granted to client roles, and single-relation views
-- are auto-updatable with OWNER (RLS-exempt) rights — revoke everything before
-- granting exactly SELECT.
revoke all on public_news, member_news, public_events, member_event_going_counts,
  member_polls, member_poll_options, poll_option_counts, transparency_stats,
  transparency_regions, admin_news, admin_events, admin_polls, admin_poll_options
  from anon, authenticated;

grant select on public_news, public_events, transparency_stats, transparency_regions
  to anon, authenticated;
grant select on member_news, member_polls, member_poll_options, poll_option_counts,
  member_event_going_counts, admin_news, admin_events, admin_polls, admin_poll_options
  to authenticated;

-- 5) Editor mutation RPCs (ADR-014 envelope: role check first, every effect +
--    the audit row in ONE transaction, token errors) ------------------------------

create function admin_save_news(p_id uuid, p_title text, p_body text, p_visibility text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := coalesce(p_body, '');
  v_row public.news%rowtype;
  v_action text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  if char_length(v_title) not between 1 and 160 then raise exception 'invalid_title'; end if;
  if char_length(v_body) not between 1 and 20000 then raise exception 'invalid_body'; end if;
  if p_visibility not in ('public', 'members') then raise exception 'invalid_status'; end if;

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

create function admin_publish_news(p_id uuid, p_slug text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.news%rowtype;
  v_slug text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.news where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status = 'published' then raise exception 'invalid_status'; end if;

  -- slug is permanent once set (URL stability — delegate precedent); a
  -- re-publish keeps the original. Concurrent duplicate surfaces as 23505 and
  -- the server action retries with a new suffix.
  v_slug := coalesce(v_row.slug, nullif(btrim(coalesce(p_slug, '')), ''));
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) > 80 then
    raise exception 'invalid_slug';
  end if;

  -- conditional DML (race guard): a concurrent transition surfaces as
  -- invalid_status instead of clobbering. Re-publish keeps the ORIGINAL
  -- published_at (accepted: list order stays stable across unpublish cycles).
  update public.news
  set status = 'published', slug = v_slug, published_at = coalesce(published_at, now())
  where id = p_id and status = 'draft';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'news.publish', 'news', p_id::text,
          jsonb_build_object('title', v_row.title, 'slug', v_slug,
                             'visibility', v_row.visibility));
  return jsonb_build_object('slug', v_slug);
end $$;

create function admin_unpublish_news(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.news%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.news where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'published' then raise exception 'invalid_status'; end if;

  update public.news set status = 'draft'
  where id = p_id and status = 'published';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'news.unpublish', 'news', p_id::text,
          jsonb_build_object('title', v_row.title, 'slug', v_row.slug));
end $$;

create function admin_delete_news(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.news%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.news where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  -- only never-published drafts are deletable; published articles are
  -- unpublished instead (spec §3.7 — history stays, audit stays meaningful)
  if v_row.status <> 'draft' or v_row.published_at is not null then
    raise exception 'invalid_status';
  end if;

  -- conditional DML: re-checks in the DELETE itself so a racing publish can
  -- never lose a published article (check-then-act guard)
  delete from public.news
  where id = p_id and status = 'draft' and published_at is null;
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'news.delete', 'news', p_id::text,
          jsonb_build_object('title', v_row.title));
end $$;

create function admin_set_news_image(p_id uuid, p_image_url text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.news%rowtype;
  v_url text := nullif(btrim(coalesce(p_image_url, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.news where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  -- pinned to the news-images bucket: this RPC pairs with the upload action,
  -- so arbitrary external URLs have no business here
  if v_url is null or char_length(v_url) > 600
     or v_url not like 'https://%/storage/v1/object/public/news-images/%' then
    raise exception 'invalid_image';
  end if;

  update public.news set image_url = v_url where id = p_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'news.set_image', 'news', p_id::text,
          jsonb_build_object('title', v_row.title));
end $$;

create function admin_save_event(
  p_id uuid, p_title text, p_description text, p_location text,
  p_starts_at timestamptz, p_ends_at timestamptz
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := coalesce(p_description, '');
  v_location text := btrim(coalesce(p_location, ''));
  v_row public.events%rowtype;
  v_action text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  if char_length(v_title) not between 1 and 160 then raise exception 'invalid_title'; end if;
  if char_length(v_description) not between 1 and 20000 then raise exception 'invalid_body'; end if;
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
    where id = p_id
    returning * into v_row;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, v_action, 'event', v_row.id::text,
          jsonb_build_object('title', v_title, 'startsAt', p_starts_at,
                             'status', v_row.status));
  return v_row.id;
end $$;

create function admin_publish_event(p_id uuid, p_slug text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.events%rowtype;
  v_slug text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.events where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'draft' then raise exception 'invalid_status'; end if;

  v_slug := coalesce(v_row.slug, nullif(btrim(coalesce(p_slug, '')), ''));
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) > 80 then
    raise exception 'invalid_slug';
  end if;

  update public.events
  set status = 'published', slug = v_slug, published_at = coalesce(published_at, now())
  where id = p_id and status = 'draft';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'event.publish', 'event', p_id::text,
          jsonb_build_object('title', v_row.title, 'slug', v_slug));
  return jsonb_build_object('slug', v_slug);
end $$;

create function admin_cancel_event(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.events%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.events where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'published' then raise exception 'invalid_status'; end if;

  update public.events set status = 'cancelled'
  where id = p_id and status = 'published';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'event.cancel', 'event', p_id::text,
          jsonb_build_object('title', v_row.title, 'slug', v_row.slug));
end $$;

create function admin_delete_event(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.events%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.events where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'draft' or v_row.published_at is not null then
    raise exception 'invalid_status';
  end if;

  delete from public.events
  where id = p_id and status = 'draft' and published_at is null;
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'event.delete', 'event', p_id::text,
          jsonb_build_object('title', v_row.title));
end $$;

create function admin_save_poll(p_id uuid, p_question text, p_options text[], p_ends_at timestamptz)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_question text := btrim(coalesce(p_question, ''));
  v_options text[];
  v_row public.polls%rowtype;
  v_opt text;
  v_pos int := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  if char_length(v_question) not between 1 and 300 then raise exception 'invalid_question'; end if;

  select array_agg(btrim(o)) into v_options
  from unnest(coalesce(p_options, '{}')) as o;
  if v_options is null
     or array_length(v_options, 1) not between 2 and 10
     or exists (select 1 from unnest(v_options) o where char_length(o) not between 1 and 120)
     or (select count(distinct o) from unnest(v_options) o) <> array_length(v_options, 1) then
    raise exception 'invalid_options';
  end if;

  if p_id is null then
    insert into public.polls (question, ends_at, created_by)
    values (v_question, p_ends_at, v_uid)
    returning * into v_row;
  else
    select * into v_row from public.polls where id = p_id;
    if not found then raise exception 'invalid_target'; end if;
    -- content is frozen the moment a poll opens (spec §3.7)
    if v_row.status <> 'draft' then raise exception 'invalid_status'; end if;
    update public.polls set question = v_question, ends_at = p_ends_at
    where id = p_id and status = 'draft'
    returning * into v_row;
    if not found then raise exception 'invalid_status'; end if;
    delete from public.poll_options where poll_id = v_row.id;
  end if;

  foreach v_opt in array v_options loop
    v_pos := v_pos + 1;
    insert into public.poll_options (poll_id, position, label)
    values (v_row.id, v_pos, v_opt);
  end loop;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'poll.save', 'poll', v_row.id::text,
          jsonb_build_object('question', v_question,
                             'optionCount', array_length(v_options, 1)));
  return v_row.id;
end $$;

create function admin_open_poll(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.polls%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.polls where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'draft' then raise exception 'invalid_status'; end if;
  -- an "open" poll nobody can vote in is a trap — fix the date first
  if v_row.ends_at is not null and v_row.ends_at <= now() then
    raise exception 'invalid_event_dates';
  end if;
  if (select count(*) from public.poll_options where poll_id = p_id) < 2 then
    raise exception 'invalid_options';
  end if;

  update public.polls set status = 'open', opened_at = now()
  where id = p_id and status = 'draft';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'poll.open', 'poll', p_id::text,
          jsonb_build_object('question', v_row.question, 'endsAt', v_row.ends_at));
end $$;

create function admin_close_poll(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.polls%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.polls where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'open' then raise exception 'invalid_status'; end if;

  update public.polls set status = 'closed', closed_at = now()
  where id = p_id and status = 'open';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'poll.close', 'poll', p_id::text,
          jsonb_build_object('question', v_row.question));
end $$;

create function admin_delete_poll(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.polls%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.polls where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'draft' then raise exception 'invalid_status'; end if;

  delete from public.polls
  where id = p_id and status = 'draft';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'poll.delete', 'poll', p_id::text,
          jsonb_build_object('question', v_row.question));
end $$;

-- 6) Member RPCs (ADR-009 envelope: subject always auth.uid(), completed
--    registration required, validation in-DB, NO audit rows) ----------------------

create function member_rsvp(p_event_id uuid, p_going boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles
                 where id = v_uid and registration_completed_at is not null) then
    raise exception 'not_completed';
  end if;
  if p_going is null then raise exception 'invalid_status'; end if;
  select * into v_event from public.events where id = p_event_id;
  if not found or v_event.status = 'draft' then raise exception 'invalid_target'; end if;
  if v_event.status = 'cancelled' or v_event.starts_at <= now() then
    raise exception 'rsvp_closed';
  end if;

  insert into public.event_rsvps (event_id, member_id, status)
  values (p_event_id, v_uid, case when p_going then 'going' else 'cancelled' end)
  on conflict (event_id, member_id)
  do update set status = excluded.status;
end $$;

create function member_cast_vote(p_poll_id uuid, p_option_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.polls%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles
                 where id = v_uid and registration_completed_at is not null) then
    raise exception 'not_completed';
  end if;
  -- FOR SHARE serializes this vote against admin_close_poll's row update
  -- (check-then-insert race) without votes blocking each other
  select * into v_poll from public.polls where id = p_poll_id for share;
  if not found or v_poll.status = 'draft' then raise exception 'invalid_target'; end if;
  if v_poll.status <> 'open'
     or (v_poll.ends_at is not null and now() > v_poll.ends_at) then
    raise exception 'poll_closed';
  end if;
  if not exists (select 1 from public.poll_options
                 where id = p_option_id and poll_id = p_poll_id) then
    raise exception 'invalid_option';
  end if;

  begin
    insert into public.poll_votes (poll_id, option_id, member_id)
    values (p_poll_id, p_option_id, v_uid);
  exception when unique_violation then
    raise exception 'already_voted';
  end;
end $$;

-- 7) Delegate read RPC (delegate_team precedent: gated to the caller's own
--    delegates row) ---------------------------------------------------------------

create function delegate_team_rsvps() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.delegates where id = v_uid) then
    raise exception 'not_a_delegate';
  end if;
  -- approved-only, mirroring delegate_team's hardening migration
  -- (20260716120000_delegate_team_approved_gate.sql): pending/rejected
  -- delegates get no team PII. Unreachable via UI (delegate pages gate
  -- pre-approval) — this is the DB boundary.
  if not exists (select 1 from public.delegates
                 where id = v_uid and status = 'approved') then
    raise exception 'not_approved';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'eventId', e.id,
             'title', e.title,
             'startsAt', e.starts_at,
             'goingCount', t.going_count,
             'going', t.names)
           order by e.starts_at)
    from public.events e
    cross join lateral (
      select count(*)::int as going_count,
             coalesce(jsonb_agg(jsonb_build_object(
               'firstName', pr.first_name, 'lastName', pr.last_name)
               order by pr.first_name, pr.last_name), '[]'::jsonb) as names
      from public.event_rsvps r
      join public.memberships m
        on m.member_id = r.member_id and m.delegate_id = v_uid and m.ended_at is null
      join public.profiles pr on pr.id = r.member_id
      where r.event_id = e.id and r.status = 'going'
    ) t
    where e.status = 'published' and coalesce(e.ends_at, e.starts_at) >= now()
  ), '[]'::jsonb);
end $$;

grant execute on function
  admin_save_news(uuid, text, text, text),
  admin_publish_news(uuid, text),
  admin_unpublish_news(uuid),
  admin_delete_news(uuid),
  admin_set_news_image(uuid, text),
  admin_save_event(uuid, text, text, text, timestamptz, timestamptz),
  admin_publish_event(uuid, text),
  admin_cancel_event(uuid),
  admin_delete_event(uuid),
  admin_save_poll(uuid, text, text[], timestamptz),
  admin_open_poll(uuid),
  admin_close_poll(uuid),
  admin_delete_poll(uuid),
  member_rsvp(uuid, boolean),
  member_cast_vote(uuid, uuid),
  delegate_team_rsvps()
to authenticated;
revoke execute on function
  admin_save_news(uuid, text, text, text),
  admin_publish_news(uuid, text),
  admin_unpublish_news(uuid),
  admin_delete_news(uuid),
  admin_set_news_image(uuid, text),
  admin_save_event(uuid, text, text, text, timestamptz, timestamptz),
  admin_publish_event(uuid, text),
  admin_cancel_event(uuid),
  admin_delete_event(uuid),
  admin_save_poll(uuid, text, text[], timestamptz),
  admin_open_poll(uuid),
  admin_close_poll(uuid),
  admin_delete_poll(uuid),
  member_rsvp(uuid, boolean),
  member_cast_vote(uuid, uuid),
  delegate_team_rsvps()
from public, anon;

-- 8) Storage --------------------------------------------------------------------

-- Public bucket, delegate-photos precedent: public read; writes only via the
-- service-role upload action paired with admin_set_news_image (spec §4.4, §6).
insert into storage.buckets (id, name, public)
values ('news-images', 'news-images', true)
on conflict (id) do update set public = true;
