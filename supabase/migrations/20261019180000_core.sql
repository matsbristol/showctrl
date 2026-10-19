-- showctrl core schema: organisations, events, one document table for every
-- collection, row-level security that mirrors src/access/access.ts,
-- src/domain/messages.ts and src/domain/admin.ts, an audit log of run sheet
-- timing changes, and a few RPCs (server time, merge-update, create event).
--
-- Why one `docs` table: the client's DataStore is document-shaped (collections
-- keyed by id, deep-merge updates), so storing each record as jsonb keeps the
-- port to the backend a straight swap. Rules that need a field (stage,
-- artist, kind, scope, to) read it from the jsonb.

-- ---------------------------------------------------------------- tenants

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id uuid not null references public.orgs on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  primary key (org_id, user_id)
);
create index org_members_user on public.org_members (user_id);

-- One event (festival, concert, conference ...). `cfg` is config/event and
-- `roles` is config/roles from the prototype. The owner is always Festival admin.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  owner uuid not null references auth.users,
  cfg jsonb not null,
  roles jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_org on public.events (org_id);
create index events_owner on public.events (owner);

-- Every collection record. `doc` is the record without its id.
create table public.docs (
  event_id uuid not null references public.events on delete cascade,
  col text not null check (col in (
    'clocks', 'stages', 'artists', 'ros', 'msgs', 'hotels', 'bookings',
    'riders', 'members', 'requests', 'people', 'stageteam')),
  id text not null,
  doc jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (event_id, col, id)
);

-- Who changed run sheet timings, and from what to what.
create table public.ros_audit (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events on delete cascade,
  item_id text not null,
  stage text,
  at timestamptz not null default now(),
  by uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  before jsonb,
  after jsonb
);
create index ros_audit_item on public.ros_audit (event_id, item_id, at desc);

-- ---------------------------------------------------------------- access helpers
-- In a schema the API doesn't expose, so they can only be used by policies
-- and the functions below. Security definer so they can read `docs` without
-- tripping over the policies they implement.

create schema if not exists private;
grant usage on schema private to authenticated;

-- The signed-in user's members/<uid> doc in an event, or null.
create function private.member(ev uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select d.doc from public.docs d
  where d.event_id = ev and d.col = 'members' and d.id = (select auth.uid())::text
$$;

create function private.is_owner(ev uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = ev and e.owner = (select auth.uid()))
$$;

-- Has any access to the event: owner, a member record, or a crew place.
create function private.is_participant(ev uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_owner(ev)
    or private.member(ev) is not null
    or exists (
      select 1 from public.docs d
      where d.event_id = ev and d.col = 'stageteam' and d.doc -> 'crew' ? (select auth.uid())::text)
$$;

-- Festival role key: the owner is always 'admin', no member record is 'none'.
create function private.role(ev uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when private.is_owner(ev) then 'admin'
    else coalesce(nullif(private.member(ev) ->> 'role', ''), 'none') end
$$;

-- Festival-wide level (0 none, 1 view, 2 edit) for a permission key. Admin is 2 everywhere.
create function private.perm(ev uuid, k text) returns int
language sql stable security definer set search_path = '' as $$
  select case when r.role = 'admin' then 2
    else coalesce((e.roles -> r.role -> 'perms' ->> k)::int, 0) end
  from (select private.role(ev) as role) r, public.events e
  where e.id = ev
$$;

-- 'manager', 'crew' or null on one stage (stageRoleOf in access.ts).
create function private.stage_role(ev uuid, sid text) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when sid is null then null
    when private.member(ev) -> 'stages' ->> sid = 'manager' then 'manager'
    when exists (
      select 1 from public.docs d
      where d.event_id = ev and d.col = 'stageteam' and d.id = sid
        and d.doc -> 'crew' ? (select auth.uid())::text) then 'crew'
  end
$$;

-- What a stage role adds on its own stage. Keep in step with STAGE_LV in src/domain/constants.ts.
create function private.stage_lv(stage_role text, k text) returns int
language sql immutable set search_path = '' as $$
  select coalesce((('{
    "manager": {"show":1,"schedule":2,"artists":2,"personnel":2,"clocks":2,"messages":2,
                "riders_tech":2,"riders_hosp":2,"accommodation":1,"setup":2},
    "crew":    {"show":1,"schedule":1,"artists":1,"personnel":1,"clocks":1,"messages":2,"riders_tech":1}
  }'::jsonb) -> stage_role ->> k)::int, 0)
$$;

-- lv(key, stageId) in access.ts: the higher of festival role and stage role.
create function private.lv(ev uuid, k text, sid text) returns int
language sql stable security definer set search_path = '' as $$
  select greatest(private.perm(ev, k), private.stage_lv(private.stage_role(ev, sid), k))
$$;

-- Manages at least one stage (stage managers may view accommodation).
create function private.manages_any(ev uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from jsonb_each_text(coalesce(private.member(ev) -> 'stages', '{}')) s where s.value = 'manager')
$$;

create function private.artist_stage(ev uuid, artist_id text) returns text
language sql stable security definer set search_path = '' as $$
  select d.doc ->> 'stage' from public.docs d
  where d.event_id = ev and d.col = 'artists' and d.id = artist_id
$$;

-- Personnel: festival-wide level, or the level on any stage the person works on.
create function private.people_lv(ev uuid, stages jsonb) returns int
language sql stable security definer set search_path = '' as $$
  select greatest(private.perm(ev, 'personnel'), coalesce((
    select max(private.lv(ev, 'personnel', s)) from jsonb_array_elements_text(
      case when jsonb_typeof(stages) = 'array' then stages else '[]' end) s), 0))
$$;

-- Who may read a document. One branch per collection.
create function private.can_read(ev uuid, c text, i text, d jsonb) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  uid text := (select auth.uid())::text;
  sid text;
begin
  if uid is null then return false; end if;
  case c
    when 'stages', 'members', 'stageteam' then
      return private.is_participant(ev);
    when 'requests' then
      -- Your own request; admins; that stage's managers.
      return i = uid or private.perm(ev, 'admin') >= 2
        or (d ->> 'stage' is not null and private.lv(ev, 'setup', d ->> 'stage') >= 2);
    when 'artists' then
      -- Note: contact details are inside the artist doc, so anyone who can
      -- see the artist can read them. The UI hides them (canSeeContacts).
      return private.lv(ev, 'artists', d ->> 'stage') >= 1;
    when 'ros' then
      return private.lv(ev, 'schedule', d ->> 'stage') >= 1;
    when 'people' then
      return private.people_lv(ev, d -> 'stages') >= 1;
    when 'clocks' then
      sid := coalesce(d ->> 'scope', case when d ->> 'kind' = 'stage' then d ->> 'stage' end);
      if sid is null then return private.is_participant(ev); end if;
      return private.lv(ev, 'clocks', sid) >= 1;
    when 'msgs' then
      -- visibleMsgs() in src/domain/messages.ts, without addressedOnly.
      if not private.is_participant(ev) then return false; end if;
      return private.perm(ev, 'admin') >= 2
        or d ->> 'from' = uid
        or coalesce(d -> 'to' ->> 't', 'all') = 'all'
        or (d -> 'to' ->> 't' = 'dept' and coalesce(private.member(ev) -> 'depts', '[]') ? (d -> 'to' ->> 'id'))
        or (d -> 'to' ->> 't' = 'stage' and (private.stage_role(ev, d -> 'to' ->> 'id') is not null or private.perm(ev, 'messages') >= 1))
        or (d -> 'to' ->> 't' = 'user' and d -> 'to' ->> 'id' = uid);
    when 'hotels' then
      return private.perm(ev, 'accommodation') >= 1 or private.manages_any(ev);
    when 'bookings' then
      return private.perm(ev, 'accommodation') >= 1
        or (d ->> 'artist' is not null and private.lv(ev, 'accommodation', private.artist_stage(ev, d ->> 'artist')) >= 1);
    when 'riders' then
      return private.lv(ev, 'riders_' || coalesce(d ->> 'kind', 'tech'), private.artist_stage(ev, d ->> 'artist')) >= 1;
    else
      return false;
  end case;
end $$;

-- Who may create, change or delete a document. Applied to the old row
-- (update/delete) and the new row (insert/update), so nobody can move a
-- record from or onto a stage they can't edit.
create function private.can_write(ev uuid, c text, i text, d jsonb, op text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  uid text := (select auth.uid())::text;
  sid text;
begin
  if uid is null then return false; end if;
  case c
    when 'stages' then
      -- Admins add and delete stages; a stage's managers edit its details and
      -- template. (Saving is an upsert, which checks the insert rule too.)
      return private.perm(ev, 'admin') >= 2 or (op <> 'delete' and private.lv(ev, 'setup', i) >= 2);
    when 'members' then
      return private.perm(ev, 'admin') >= 2;
    when 'stageteam' then
      return private.perm(ev, 'admin') >= 2 or private.lv(ev, 'setup', i) >= 2;
    when 'requests' then
      -- Anyone signed in may ask to join (their own request, keyed by their id).
      return i = uid or private.perm(ev, 'admin') >= 2
        or (op = 'delete' and d ->> 'stage' is not null and private.lv(ev, 'setup', d ->> 'stage') >= 2);
    when 'artists' then
      return private.lv(ev, 'artists', d ->> 'stage') >= 2;
    when 'ros' then
      return private.lv(ev, 'schedule', d ->> 'stage') >= 2;
    when 'people' then
      return private.people_lv(ev, d -> 'stages') >= 2;
    when 'clocks' then
      sid := coalesce(d ->> 'scope', case when d ->> 'kind' = 'stage' then d ->> 'stage' end);
      return private.lv(ev, 'clocks', sid) >= 2;
    when 'msgs' then
      if op = 'insert' then
        -- You can only send as yourself.
        return d ->> 'from' = uid and private.is_participant(ev);
      elsif op = 'delete' then
        return d ->> 'from' = uid or private.perm(ev, 'admin') >= 2;
      else
        -- Updates are acknowledgements; the msgs_guard trigger limits them.
        return private.can_read(ev, c, i, d);
      end if;
    when 'hotels', 'bookings' then
      return private.perm(ev, 'accommodation') >= 2;
    when 'riders' then
      return private.lv(ev, 'riders_' || coalesce(d ->> 'kind', 'tech'), private.artist_stage(ev, d ->> 'artist')) >= 2;
    else
      return false;
  end case;
end $$;

grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------- triggers

-- The id lives in the key, never in the body; stamp who changed it and when.
create function private.docs_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.doc := new.doc - 'id';
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger docs_stamp before insert or update on public.docs
for each row execute function private.docs_stamp();

-- Messages: anyone who can see one may acknowledge it, but only for
-- themselves. The sender and admins may change anything.
create function private.msgs_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  uid text := (select auth.uid())::text;
begin
  if new.col <> 'msgs' or uid is null then return new; end if;
  if old.doc ->> 'from' = uid or private.perm(new.event_id, 'admin') >= 2 then return new; end if;
  if (new.doc - 'acks') is distinct from (old.doc - 'acks')
     or (coalesce(new.doc -> 'acks', '{}') - uid) is distinct from (coalesce(old.doc -> 'acks', '{}') - uid) then
    raise exception 'You can only acknowledge a message for yourself' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger msgs_guard before update on public.docs
for each row when (new.col = 'msgs') execute function private.msgs_guard();

-- Audit log: every run sheet change that touches timing or status.
create function private.ros_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  keys text[] := array['start', 'end', 'delay', 'delayNote', 'status', 'actual', 'actualEnd', 'stage', 'title'];
  b jsonb;
  a jsonb;
begin
  if coalesce(new.col, old.col) <> 'ros' then return null; end if;
  if tg_op <> 'INSERT' then
    select jsonb_object_agg(k, old.doc -> k) into b from unnest(keys) k where old.doc ? k;
  end if;
  if tg_op <> 'DELETE' then
    select jsonb_object_agg(k, new.doc -> k) into a from unnest(keys) k where new.doc ? k;
  end if;
  if tg_op = 'UPDATE' and b is not distinct from a then return null; end if;
  insert into public.ros_audit (event_id, item_id, stage, by, action, before, after)
  values (
    coalesce(new.event_id, old.event_id), coalesce(new.id, old.id),
    coalesce(new.doc, old.doc) ->> 'stage', auth.uid(), lower(tg_op), b, a);
  return null;
end $$;

-- (A WHEN clause can't name both NEW and OLD here, so the function checks the collection.)
create trigger ros_audit after insert or update or delete on public.docs
for each row execute function private.ros_audit();

create function private.events_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger events_stamp before update on public.events
for each row execute function private.events_stamp();

-- ---------------------------------------------------------------- row-level security

alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.events enable row level security;
alter table public.docs enable row level security;
alter table public.ros_audit enable row level security;

create function private.in_org(o uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.org_members m where m.org_id = o and m.user_id = (select auth.uid()))
$$;
grant execute on function private.in_org(uuid) to authenticated;

create policy "members see their organisation" on public.orgs
  for select to authenticated using (private.in_org(id));
create policy "members see who is in their organisation" on public.org_members
  for select to authenticated using (private.in_org(org_id));

create policy "participants see the event" on public.events
  for select to authenticated using (private.is_participant(id));
create policy "admins change the event" on public.events
  for update to authenticated
  using (private.perm(id, 'admin') >= 2) with check (private.perm(id, 'admin') >= 2);
-- Only the settings can change from the client, never the owner or organisation.
revoke update on public.events from authenticated, anon;
grant update (cfg, roles) on public.events to authenticated;

create policy "read by access rules" on public.docs
  for select to authenticated using (private.can_read(event_id, col, id, doc));
create policy "insert by access rules" on public.docs
  for insert to authenticated with check (private.can_write(event_id, col, id, doc, 'insert'));
create policy "update by access rules" on public.docs
  for update to authenticated
  using (private.can_write(event_id, col, id, doc, 'update'))
  with check (private.can_write(event_id, col, id, doc, 'update'));
create policy "delete by access rules" on public.docs
  for delete to authenticated using (private.can_write(event_id, col, id, doc, 'delete'));

create policy "schedule readers see timing history" on public.ros_audit
  for select to authenticated using (private.lv(event_id, 'schedule', stage) >= 1);

-- Nothing is visible without signing in.
revoke all on public.orgs, public.org_members, public.events, public.docs, public.ros_audit from anon;

-- ---------------------------------------------------------------- RPCs

-- Server time in epoch ms, for clock sync (src/clock/clock.ts).
create function public.server_now() returns bigint
language sql volatile set search_path = '' as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint
$$;

-- Deep merge, arrays replaced (deepMerge in src/data/localStore.ts).
create function private.merge(a jsonb, b jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then (
      select coalesce(jsonb_object_agg(k, case
        when a ? k and b ? k then private.merge(a -> k, b -> k)
        when b ? k then b -> k
        else a -> k end), '{}')
      from (select jsonb_object_keys(a) k union select jsonb_object_keys(b)) keys)
    else b end
$$;

-- DataStore.update: merge a patch into a document on the server, so two
-- people acknowledging the same message don't overwrite each other.
-- Security invoker: the docs policies decide.
create function public.doc_patch(ev uuid, c text, i text, patch jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.docs set doc = private.merge(doc, patch - 'id')
  where event_id = ev and col = c and id = i;
  if not found then
    raise exception '%/% does not exist or you may not change it', c, i using errcode = 'P0002';
  end if;
end $$;

-- A new event, in a new organisation (org null) or one you belong to.
-- You become its owner, and your members record makes you Festival admin.
create function public.create_event(org uuid, org_name text, cfg jsonb, roles jsonb, my_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  o uuid := org;
  ev uuid;
begin
  if uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if o is null then
    insert into public.orgs (name) values (coalesce(nullif(org_name, ''), 'My organisation')) returning id into o;
    insert into public.org_members (org_id, user_id, role) values (o, uid, 'owner');
  elsif not private.in_org(o) then
    raise exception 'Not a member of that organisation' using errcode = '42501';
  end if;
  insert into public.events (org_id, owner, cfg, roles) values (o, uid, cfg, roles) returning id into ev;
  insert into public.docs (event_id, col, id, doc)
  values (ev, 'members', uid::text, jsonb_build_object('name', my_name, 'role', 'admin', 'stages', '{}'::jsonb, 'depts', '[]'::jsonb, 'person', null));
  return ev;
end $$;

-- The name of an event, for someone with a link who is asking to join.
create function public.event_name(ev uuid) returns text
language sql stable security definer set search_path = '' as $$
  select e.cfg ->> 'name' from public.events e where e.id = ev and auth.uid() is not null
$$;

revoke execute on function public.server_now() from public;
revoke execute on function public.doc_patch(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.create_event(uuid, text, jsonb, jsonb, text) from public, anon;
revoke execute on function public.event_name(uuid) from public, anon;
grant execute on function public.server_now() to anon, authenticated;
grant execute on function public.doc_patch(uuid, text, text, jsonb) to authenticated;
grant execute on function public.create_event(uuid, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.event_name(uuid) to authenticated;

-- ---------------------------------------------------------------- realtime

alter publication supabase_realtime add table public.docs, public.events;
