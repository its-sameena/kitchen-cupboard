-- Profile colours must be unique within a kitchen.

-- 1. Give any existing duplicates (all but the earliest profile) a free colour.
do $$
declare
  r record;
  c text;
  palette text[] := array['#e4572e', '#2e86de', '#2fa84f', '#9b59b6', '#f1a208', '#e84393', '#16a3a3', '#6d4c41',
                          '#c0392b', '#1abc9c', '#34495e', '#d35400', '#8e44ad', '#27ae60', '#2980b9', '#7f8c8d'];
begin
  for r in
    select id, kitchen_id from (
      select m.id, m.kitchen_id,
             row_number() over (partition by m.kitchen_id, lower(m.color) order by m.joined_at, m.id) as rn
        from public.members m
    ) x where rn > 1
  loop
    select p into c from unnest(palette) as p
     where not exists (select 1 from public.members where kitchen_id = r.kitchen_id and lower(color) = lower(p))
     limit 1;
    if c is null then c := '#' || substr(md5(random()::text), 1, 6); end if;
    update public.members set color = c where id = r.id;
  end loop;
end $$;

-- 2. Enforce it (covers profile creation and colour changes in House).
create unique index members_unique_color on public.members (kitchen_id, lower(color));

-- 3. Friendlier message when creating a profile with a taken colour.
create or replace function public.create_profile(p_name text, p_color text) returns json
language plpgsql security definer set search_path = public as $$
declare k uuid := public.my_kitchen(); m uuid; e uuid; owner text;
begin
  if k is null then raise exception 'This device is not in a kitchen'; end if;
  if exists (select 1 from public.members where kitchen_id = k and lower(name) = lower(trim(p_name))) then
    raise exception 'There is already a profile called %', trim(p_name);
  end if;
  select name into owner from public.members where kitchen_id = k and lower(color) = lower(p_color);
  if owner is not null then
    raise exception '% already uses that colour. Pick another one.', owner;
  end if;
  insert into public.members (kitchen_id, name, color) values (k, trim(p_name), p_color) returning id into m;
  e := public._event(k, 'joined', m, null, trim(p_name) || ' joined the kitchen', 'Say hi!');
  return json_build_object('member_id', m, 'event_id', e);
end $$;
