-- 1. Housemates can edit or delete their own feedback.
-- 2. Items use named line icons (see src/icons.tsx) instead of emoji: the
--    `emoji` columns now hold an icon key such as 'milk' or 'coffee'.
-- 3. Event titles/bodies are plain text (they double as push notification text).

-- ───────────────────────── feedback editing ─────────────────────────

alter table public.feedback add column edited_at timestamptz;

create function public.update_feedback(p_me uuid, p_id uuid, p_kind text, p_message text) returns void
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me);
begin
  update public.feedback
     set kind = p_kind, message = trim(p_message), edited_at = now()
   where id = p_id and kitchen_id = k and member_id = p_me;
  if not found then raise exception 'You can only edit your own feedback'; end if;
end $$;

create function public.delete_feedback(p_me uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me);
begin
  delete from public.feedback where id = p_id and kitchen_id = k and member_id = p_me;
  if not found then raise exception 'You can only delete your own feedback'; end if;
end $$;

revoke execute on function public.update_feedback(uuid, uuid, text, text), public.delete_feedback(uuid, uuid)
  from public, anon;
grant execute on function public.update_feedback(uuid, uuid, text, text), public.delete_feedback(uuid, uuid)
  to authenticated;

-- ───────────────────────── emoji → icon keys ─────────────────────────

alter table public.items alter column emoji set default 'package';
alter table public.grocery alter column emoji set default 'shopping-bag';

create temporary table _icon_map (e text primary key, icon text not null);
insert into _icon_map values
  ('🧂','flask-round'), ('🌶️','flame'), ('🌶','flame'), ('🌿','leaf'), ('🧄','leaf'), ('🧅','leafy-green'),
  ('🫚','leaf'), ('🥛','milk'), ('🧀','milk'), ('🧈','milk'), ('🥚','egg'), ('🥣','soup'), ('🍗','drumstick'),
  ('🥩','beef'), ('🥓','ham'), ('🐟','fish'), ('🧊','snowflake'), ('🍨','ice-cream'), ('🍕','pizza'),
  ('🌾','wheat'), ('🍬','candy'), ('🧁','cupcake'), ('🍯','amphora'), ('☕','coffee'), ('🍵','coffee'),
  ('🍝','cooking-pot'), ('🍚','cooking-pot'), ('🍞','sandwich'), ('🥫','can'), ('🫙','amphora'),
  ('🫒','droplet'), ('🥔','popcorn'), ('🍫','candy'), ('🍪','cookie'), ('🍿','popcorn'), ('🥜','nut'),
  ('🧃','cup-soda'), ('🥤','cup-soda'), ('🍺','beer'), ('🍷','wine'), ('🍎','apple'), ('🍌','banana'),
  ('🍋','citrus'), ('🍊','citrus'), ('🥑','avocado'), ('🍅','cherry'), ('🥕','carrot'), ('🥬','leafy-green'),
  ('🍓','cherry'), ('🍇','grape'), ('🥒','leafy-green'), ('🌽','wheat'), ('🍄','sprout'), ('🥡','soup'),
  ('🧻','spray-can'), ('📦','package'), ('🛍️','shopping-bag'), ('🛍','shopping-bag');

update public.items i set emoji = m.icon from _icon_map m where i.emoji = m.e;
update public.grocery g set emoji = m.icon from _icon_map m where g.emoji = m.e;
update public.items set emoji = 'package' where emoji !~ '^[a-z][a-z0-9-]*$';
update public.grocery set emoji = 'shopping-bag' where emoji !~ '^[a-z][a-z0-9-]*$';
drop table _icon_map;

-- Strip emoji from existing activity titles/bodies.
update public.events
   set title = trim(regexp_replace(title, '[\U0001F000-\U0001FAFF☀-➿️‍]', '', 'g')),
       body  = trim(regexp_replace(body,  '[\U0001F000-\U0001FAFF☀-➿️‍]', '', 'g'));

-- ───────────────────────── plain-text events ─────────────────────────

create or replace function public.create_profile(p_name text, p_color text) returns json
language plpgsql security definer set search_path = public as $$
declare k uuid := public.my_kitchen(); m uuid; e uuid;
begin
  if k is null then raise exception 'This device is not in a kitchen'; end if;
  if exists (select 1 from public.members where kitchen_id = k and lower(name) = lower(trim(p_name))) then
    raise exception 'There is already a profile called %', trim(p_name);
  end if;
  insert into public.members (kitchen_id, name, color) values (k, trim(p_name), p_color) returning id into m;
  e := public._event(k, 'joined', m, null, trim(p_name) || ' joined the kitchen', 'Say hi!');
  return json_build_object('member_id', m, 'event_id', e);
end $$;

create or replace function public.ran_out(p_me uuid, p_item uuid) returns uuid
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
    r.name || ' is out of stock',
    public._name(p_me) || ' used the last of it. It''s on the grocery list.');
end $$;

create or replace function public.add_grocery(p_me uuid, p_name text, p_emoji text, p_category text, p_item uuid default null) returns uuid
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
      public._name(p_me) || ' asked for ' || trim(p_name), 'Added to your shopping list.');
  end if;
  return null;
end $$;

create or replace function public.request_entry(p_me uuid, p_entry uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me); run public.runs := public._active_run(k); g public.grocery;
begin
  if run.id is null or run.shopper_id = p_me then return null; end if;
  update public.grocery set for_user = p_me, run_id = run.id where id = p_entry and kitchen_id = k returning * into g;
  if not found then return null; end if;
  return public._event(k, 'request', p_me, array[run.shopper_id],
    public._name(p_me) || ' asked for ' || g.name, 'Please pick it up on your run.');
end $$;

create or replace function public.mark_bought(p_me uuid, p_entry uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me); g public.grocery; r public.items; v_owner uuid;
begin
  delete from public.grocery where id = p_entry and kitchen_id = k returning * into g;
  if not found then return null; end if;
  v_owner := coalesce(g.for_user, p_me);
  r := public._restock(k, g.name, g.emoji, g.category, g.item_id, v_owner);
  return public._event(k, 'restocked', p_me, null, r.name || ' is back',
    public._name(p_me) || ' restocked it' || case when v_owner <> p_me then ' for ' || public._name(v_owner) else '' end || '.');
end $$;

create or replace function public.start_run(p_me uuid, p_store text) returns uuid
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
    public._name(p_me) || ' is going grocery shopping' || case when s <> '' then ' at ' || s else '' end,
    'Need anything? Tap to request items.');
end $$;

create or replace function public.end_run(p_me uuid) returns uuid
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
    names := names || g.name;
  end loop;
  update public.grocery set run_id = null where run_id = run.id;
  return public._event(k, 'run_ended', p_me, null,
    public._name(p_me) || ' is back from the shops',
    case when cardinality(names) = 0 then 'Nothing picked up this time.'
         else 'Picked up: ' || array_to_string(names[1:6], ', ') || case when cardinality(names) > 6 then '…' else '' end end);
end $$;
