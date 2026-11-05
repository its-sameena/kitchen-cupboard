-- Kitchen Cupboard: schema, row level security and RPCs.
--
-- Access model ("we trust each other"):
--   * Each phone signs in with Supabase *anonymous* auth (no email/password).
--   * A device joins a kitchen once (create, or invite code) → row in `devices`.
--   * Housemates are *profiles* (`members`); a device picks one, Netflix-style.
--   * RLS limits every device to its own kitchen. RPCs take `p_me` (the chosen
--     profile) and check it belongs to that kitchen.
-- Multi-step changes run inside SECURITY DEFINER functions so they are atomic.

-- ───────────────────────── tables ─────────────────────────

create table public.kitchens (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Kitchen' check (char_length(name) between 1 and 40),
  invite_code text not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_at timestamptz not null default now()
);

create table public.devices (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  kitchen_id uuid not null references public.kitchens on delete cascade,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  seen_at timestamptz not null default now(),
  joined_at timestamptz not null default now()
);
create unique index members_unique_name on public.members (kitchen_id, lower(name));

create table public.items (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  emoji text not null default '📦' check (char_length(emoji) <= 16),
  category text not null check (category in (
    'spices','dairy','cold','frozen','drinks','baking','coffee','grains','canned','sauces','snacks','produce','other')),
  owners uuid[] not null default '{}',
  created_by uuid,
  updated_at timestamptz not null default now()
);
create unique index items_unique_name on public.items (kitchen_id, lower(name), category);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens on delete cascade,
  shopper_id uuid not null,
  store text not null default '' check (char_length(store) <= 30),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index runs_one_active on public.runs (kitchen_id) where ended_at is null;

create table public.grocery (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  emoji text not null default '🛍️' check (char_length(emoji) <= 16),
  category text not null default 'other',
  item_id uuid references public.items on delete set null,
  added_by uuid,
  for_user uuid,
  run_id uuid references public.runs on delete set null,
  got_by uuid,
  added_at timestamptz not null default now()
);
create index grocery_kitchen on public.grocery (kitchen_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens on delete cascade,
  type text not null,
  actor_id uuid not null,
  targets uuid[],
  title text not null,
  body text not null default '',
  pushed boolean not null default false,
  at timestamptz not null default now()
);
create index events_kitchen_at on public.events (kitchen_id, at desc);

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kitchen_id uuid not null references public.kitchens on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  p256dh text not null,
  auth text not null,
  updated_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens on delete cascade,
  member_id uuid references public.members on delete set null,
  member_name text not null,
  kind text not null check (kind in ('bug', 'idea', 'other')),
  message text not null check (char_length(message) between 1 and 2000),
  context jsonb not null default '{}',
  status text not null default 'new' check (status in ('new', 'planned', 'in_progress', 'done', 'wont_do')),
  reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_kitchen on public.feedback (kitchen_id, created_at desc);

-- ───────────────────────── helpers ─────────────────────────

create function public.my_kitchen() returns uuid
language sql stable security definer set search_path = public as $$
  select kitchen_id from public.devices where user_id = auth.uid()
$$;

-- Validates the acting profile and returns its kitchen.
create function public._check(p_me uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare k uuid;
begin
  if auth.uid() is null then raise exception 'Not connected'; end if;
  k := public.my_kitchen();
  if k is null then raise exception 'This device is not in a kitchen'; end if;
  if not exists (select 1 from public.members where id = p_me and kitchen_id = k) then
    raise exception 'Profile not found. Pick your profile again.';
  end if;
  return k;
end $$;

create function public._name(m uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select name from public.members where id = m), 'Someone')
$$;

create function public._event(k uuid, t text, actor uuid, tgts uuid[], ttl text, bdy text) returns uuid
language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  insert into public.events (kitchen_id, type, actor_id, targets, title, body)
  values (k, t, actor, tgts, ttl, bdy) returning id into eid;
  delete from public.events where kitchen_id = k and at < now() - interval '60 days';
  return eid;
end $$;

-- Put an item in the cupboard owned by p_owner (creating it if needed).
create function public._restock(k uuid, p_name text, p_emoji text, p_cat text, p_item uuid, p_owner uuid)
returns public.items
language plpgsql security definer set search_path = public as $$
declare r public.items;
begin
  if p_item is not null then
    update public.items
       set owners = case when p_owner = any(owners) then owners else owners || p_owner end,
           updated_at = now()
     where id = p_item and kitchen_id = k
    returning * into r;
    if found then return r; end if;
  end if;
  insert into public.items (kitchen_id, name, emoji, category, owners, created_by)
  values (k, trim(p_name), p_emoji, p_cat, array[p_owner], p_owner)
  on conflict (kitchen_id, lower(name), category) do update
     set owners = case when p_owner = any(items.owners) then items.owners else items.owners || p_owner end,
         updated_at = now()
  returning * into r;
  return r;
end $$;

-- Remove open grocery entries satisfied by this item.
create function public._drop_grocery(k uuid, r public.items) returns void
language sql security definer set search_path = public as $$
  delete from public.grocery
   where kitchen_id = k and got_by is null
     and (item_id = r.id or (lower(name) = lower(r.name) and category = r.category))
$$;

create function public._active_run(k uuid) returns public.runs
language sql stable security definer set search_path = public as $$
  select * from public.runs where kitchen_id = k and ended_at is null limit 1
$$;

-- ───────────────────────── kitchens, devices, profiles ─────────────────────────

create function public.create_kitchen(p_kitchen text) returns uuid
language plpgsql security definer set search_path = public as $$
declare k uuid;
begin
  if auth.uid() is null then raise exception 'Not connected'; end if;
  if public.my_kitchen() is not null then raise exception 'This device is already in a kitchen'; end if;
  insert into public.kitchens (name) values (coalesce(nullif(trim(p_kitchen), ''), 'Our Kitchen')) returning id into k;
  insert into public.devices (user_id, kitchen_id) values (auth.uid(), k);
  return k;
end $$;

create function public.join_kitchen(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare k uuid;
begin
  if auth.uid() is null then raise exception 'Not connected'; end if;
  select id into k from public.kitchens where invite_code = upper(trim(p_code));
  if k is null then raise exception 'No kitchen found with that code'; end if;
  insert into public.devices (user_id, kitchen_id) values (auth.uid(), k)
  on conflict (user_id) do update set kitchen_id = excluded.kitchen_id;
  return k;
end $$;

-- Disconnect this phone from the kitchen (profiles and data stay).
create function public.forget_device() returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where user_id = auth.uid();
  delete from public.devices where user_id = auth.uid();
$$;

create function public.create_profile(p_name text, p_color text) returns json
language plpgsql security definer set search_path = public as $$
declare k uuid := public.my_kitchen(); m uuid; e uuid;
begin
  if k is null then raise exception 'This device is not in a kitchen'; end if;
  if exists (select 1 from public.members where kitchen_id = k and lower(name) = lower(trim(p_name))) then
    raise exception 'There is already a profile called %', trim(p_name);
  end if;
  insert into public.members (kitchen_id, name, color) values (k, trim(p_name), p_color) returning id into m;
  e := public._event(k, 'joined', m, null, trim(p_name) || ' joined the kitchen', 'Say hi 👋');
  return json_build_object('member_id', m, 'event_id', e);
end $$;

-- Remove a profile: their items come off the shelves.
create function public.delete_profile(p_me uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me);
begin
  update public.items set owners = array_remove(owners, p_me) where kitchen_id = k and p_me = any(owners);
  update public.runs set ended_at = now() where kitchen_id = k and shopper_id = p_me and ended_at is null;
  update public.grocery set for_user = null, run_id = null where kitchen_id = k and for_user = p_me;
  delete from public.members where id = p_me;
end $$;

-- ───────────────────────── cupboard ─────────────────────────

create function public.add_item(p_me uuid, p_name text, p_emoji text, p_category text) returns void
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me); r public.items;
begin
  r := public._restock(k, p_name, p_emoji, p_category, null, p_me);
  perform public._drop_grocery(k, r);
end $$;

create function public.have_it_too(p_me uuid, p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me); r public.items;
begin
  select * into r from public.items where id = p_item and kitchen_id = k;
  if not found then raise exception 'Item not found'; end if;
  r := public._restock(k, r.name, r.emoji, r.category, r.id, p_me);
  perform public._drop_grocery(k, r);
end $$;

-- Remove my copy; when nobody has it any more it goes on the grocery list.
create function public.ran_out(p_me uuid, p_item uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me); r public.items;
begin
  update public.items set owners = array_remove(owners, p_me), updated_at = now()
   where id = p_item and kitchen_id = k
  returning * into r;
  if not found or cardinality(r.owners) > 0 then return null; end if;
  if not exists (select 1 from public.grocery where item_id = r.id and got_by is null) then
    insert into public.grocery (kitchen_id, name, emoji, category, item_id, added_by)
    values (k, r.name, r.emoji, r.category, r.id, p_me);
  end if;
  return public._event(k, 'out_of_stock', p_me, null,
    r.emoji || ' ' || r.name || ' is out of stock',
    public._name(p_me) || ' used the last of it. It''s on the grocery list.');
end $$;

create function public.update_item(p_me uuid, p_item uuid, p_name text, p_emoji text, p_category text) returns void
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me);
begin
  update public.items set name = trim(p_name), emoji = p_emoji, category = p_category, updated_at = now()
   where id = p_item and kitchen_id = k;
  update public.grocery set name = trim(p_name), emoji = p_emoji, category = p_category
   where item_id = p_item and kitchen_id = k;
end $$;

-- ───────────────────────── grocery list ─────────────────────────

create function public.add_grocery(p_me uuid, p_name text, p_emoji text, p_category text, p_item uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  k uuid := public._check(p_me);
  run public.runs := public._active_run(k);
  requesting boolean := coalesce(run.id is not null and run.shopper_id <> p_me, false);
  existing uuid;
begin
  select id into existing from public.grocery
   where kitchen_id = k and got_by is null
     and ((p_item is not null and item_id = p_item) or (lower(name) = lower(trim(p_name)) and category = p_category))
   limit 1;
  if existing is null then
    insert into public.grocery (kitchen_id, name, emoji, category, item_id, added_by, for_user, run_id)
    values (k, trim(p_name), p_emoji, p_category, p_item, p_me,
            case when requesting then p_me end, case when requesting then run.id end)
    returning id into existing;
  elsif requesting then
    update public.grocery set for_user = p_me, run_id = run.id where id = existing;
  end if;
  if requesting then
    return public._event(k, 'request', p_me, array[run.shopper_id],
      public._name(p_me) || ' asked for ' || p_emoji || ' ' || trim(p_name), 'Added to your shopping list.');
  end if;
  return null;
end $$;

create function public.request_entry(p_me uuid, p_entry uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me); run public.runs := public._active_run(k); g public.grocery;
begin
  if run.id is null or run.shopper_id = p_me then return null; end if;
  update public.grocery set for_user = p_me, run_id = run.id where id = p_entry and kitchen_id = k returning * into g;
  if not found then return null; end if;
  return public._event(k, 'request', p_me, array[run.shopper_id],
    public._name(p_me) || ' asked for ' || g.emoji || ' ' || g.name, 'Please pick it up on your run 🙏');
end $$;

create function public.unrequest_entry(p_me uuid, p_entry uuid) returns void
language sql security definer set search_path = public as $$
  update public.grocery set for_user = null, run_id = null
   where id = p_entry and kitchen_id = public._check(p_me) and for_user = p_me
$$;

-- Bought outside of a run: goes straight back into the cupboard.
create function public.mark_bought(p_me uuid, p_entry uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me); g public.grocery; r public.items; v_owner uuid;
begin
  delete from public.grocery where id = p_entry and kitchen_id = k returning * into g;
  if not found then return null; end if;
  v_owner := coalesce(g.for_user, p_me);
  r := public._restock(k, g.name, g.emoji, g.category, g.item_id, v_owner);
  return public._event(k, 'restocked', p_me, null, r.emoji || ' ' || r.name || ' is back',
    public._name(p_me) || ' restocked it' || case when v_owner <> p_me then ' for ' || public._name(v_owner) else '' end || '.');
end $$;

-- ───────────────────────── grocery runs ─────────────────────────

create function public.start_run(p_me uuid, p_store text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  k uuid := public._check(p_me); s text := trim(coalesce(p_store, ''));
  cur public.runs := public._active_run(k);
begin
  if cur.id is not null then
    raise exception '% is already on a grocery run', public._name(cur.shopper_id);
  end if;
  insert into public.runs (kitchen_id, shopper_id, store) values (k, p_me, s);
  return public._event(k, 'run_started', p_me, null,
    '🛒 ' || public._name(p_me) || ' is going grocery shopping' || case when s <> '' then ' at ' || s else '' end,
    'Need anything? Tap to request items.');
end $$;

create function public.toggle_got(p_me uuid, p_entry uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me); run public.runs := public._active_run(k);
begin
  if run.id is null or run.shopper_id <> p_me then raise exception 'Only the shopper can tick items off'; end if;
  update public.grocery set got_by = case when got_by is null then p_me end
   where id = p_entry and kitchen_id = k;
end $$;

create function public.end_run(p_me uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  k uuid := public._check(p_me);
  run public.runs := public._active_run(k);
  g public.grocery; r public.items; names text[] := '{}';
begin
  if run.id is null or run.shopper_id <> p_me then return null; end if;
  update public.runs set ended_at = now() where id = run.id;
  for g in delete from public.grocery where kitchen_id = k and got_by is not null returning * loop
    r := public._restock(k, g.name, g.emoji, g.category, g.item_id, coalesce(g.for_user, p_me));
    names := names || (g.emoji || ' ' || g.name);
  end loop;
  update public.grocery set run_id = null where run_id = run.id;
  return public._event(k, 'run_ended', p_me, null,
    '🏠 ' || public._name(p_me) || ' is back from the shops',
    case when cardinality(names) = 0 then 'Nothing picked up this time.'
         else 'Picked up: ' || array_to_string(names[1:6], ', ') || case when cardinality(names) > 6 then '…' else '' end end);
end $$;

-- ───────────────────────── feedback ─────────────────────────

create function public.submit_feedback(p_me uuid, p_kind text, p_message text, p_context jsonb default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me); fid uuid;
begin
  insert into public.feedback (kitchen_id, member_id, member_name, kind, message, context)
  values (k, p_me, public._name(p_me), p_kind, trim(p_message), coalesce(p_context, '{}'))
  returning id into fid;
  return fid;
end $$;

-- Keep updated_at fresh when the developer changes status/reply.
create function public._touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger feedback_touch before update on public.feedback for each row execute function public._touch();

-- ───────────────────────── security ─────────────────────────

alter table public.kitchens enable row level security;
alter table public.devices enable row level security;
alter table public.members enable row level security;
alter table public.items enable row level security;
alter table public.runs enable row level security;
alter table public.grocery enable row level security;
alter table public.events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.feedback enable row level security;

create policy "read own kitchen" on public.kitchens for select to authenticated using (id = public.my_kitchen());
create policy "rename own kitchen" on public.kitchens for update to authenticated
  using (id = public.my_kitchen()) with check (id = public.my_kitchen());

create policy "read own device" on public.devices for select to authenticated using (user_id = auth.uid());

create policy "read profiles" on public.members for select to authenticated using (kitchen_id = public.my_kitchen());
create policy "edit profiles" on public.members for update to authenticated
  using (kitchen_id = public.my_kitchen()) with check (kitchen_id = public.my_kitchen());

create policy "read items" on public.items for select to authenticated using (kitchen_id = public.my_kitchen());
create policy "delete items" on public.items for delete to authenticated using (kitchen_id = public.my_kitchen());

create policy "read grocery" on public.grocery for select to authenticated using (kitchen_id = public.my_kitchen());
create policy "delete grocery" on public.grocery for delete to authenticated using (kitchen_id = public.my_kitchen());

create policy "read runs" on public.runs for select to authenticated using (kitchen_id = public.my_kitchen());
create policy "read events" on public.events for select to authenticated using (kitchen_id = public.my_kitchen());
create policy "read feedback" on public.feedback for select to authenticated using (kitchen_id = public.my_kitchen());

create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and kitchen_id = public.my_kitchen()
              and exists (select 1 from public.members m where m.id = member_id and m.kitchen_id = public.my_kitchen()));

-- Only these columns may be edited directly; everything else goes through RPCs.
revoke insert, update on public.kitchens, public.devices, public.members, public.items, public.runs,
  public.grocery, public.events, public.feedback from anon, authenticated;
revoke delete on public.kitchens, public.devices, public.members, public.runs, public.events, public.feedback
  from anon, authenticated;
grant update (name) on public.kitchens to authenticated;
grant update (name, color, seen_at) on public.members to authenticated;
revoke all on public.kitchens, public.devices, public.members, public.items, public.runs, public.grocery,
  public.events, public.push_subscriptions, public.feedback from anon;

-- Internal helpers are not callable from the app.
revoke execute on function public._check(uuid), public._name(uuid),
  public._event(uuid, text, uuid, uuid[], text, text),
  public._restock(uuid, text, text, text, uuid, uuid),
  public._drop_grocery(uuid, public.items), public._active_run(uuid), public._touch()
  from public, anon, authenticated;
revoke execute on function public.my_kitchen(), public.create_kitchen(text), public.join_kitchen(text),
  public.forget_device(), public.create_profile(text, text), public.delete_profile(uuid),
  public.add_item(uuid, text, text, text), public.have_it_too(uuid, uuid), public.ran_out(uuid, uuid),
  public.update_item(uuid, uuid, text, text, text), public.add_grocery(uuid, text, text, text, uuid),
  public.request_entry(uuid, uuid), public.unrequest_entry(uuid, uuid), public.mark_bought(uuid, uuid),
  public.start_run(uuid, text), public.toggle_got(uuid, uuid), public.end_run(uuid),
  public.submit_feedback(uuid, text, text, jsonb)
  from public, anon;
grant execute on function public.my_kitchen(), public.create_kitchen(text), public.join_kitchen(text),
  public.forget_device(), public.create_profile(text, text), public.delete_profile(uuid),
  public.add_item(uuid, text, text, text), public.have_it_too(uuid, uuid), public.ran_out(uuid, uuid),
  public.update_item(uuid, uuid, text, text, text), public.add_grocery(uuid, text, text, text, uuid),
  public.request_entry(uuid, uuid), public.unrequest_entry(uuid, uuid), public.mark_bought(uuid, uuid),
  public.start_run(uuid, text), public.toggle_got(uuid, uuid), public.end_run(uuid),
  public.submit_feedback(uuid, text, text, jsonb)
  to authenticated;

-- ───────────────────────── realtime ─────────────────────────

alter publication supabase_realtime add table
  public.kitchens, public.members, public.items, public.runs, public.grocery, public.events, public.feedback;
