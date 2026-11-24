-- Remember what was bought on each grocery run (feedback 849362db), and let each
-- profile clear runs from its own recent-runs list.
-- Additive only: two new tables, one new nullable column, end_run gains one step,
-- and a new hide_run function. Nothing existing is deleted or changed.
-- Runs finished before this have item_count NULL (the app shows no count or details for them).

-- 1. One row per item bought on a run.
create table public.run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs on delete cascade,
  kitchen_id uuid not null references public.kitchens on delete cascade,
  name text not null,
  emoji text not null default 'package',
  category text not null default 'other',
  -- Who it went to in the cupboard (the requester, or the shopper).
  for_user uuid,
  -- True if a housemate asked for it during the run.
  requested boolean not null default false,
  bought_at timestamptz not null default now()
);
create index run_items_run on public.run_items (run_id);

-- 2. How many items each run bought. NULL = finished before items were recorded.
alter table public.runs add column item_count integer;

-- 3. Housemates can read their own kitchen's lists; only end_run writes them.
alter table public.run_items enable row level security;
create policy "read run items" on public.run_items for select to authenticated using (kitchen_id = public.my_kitchen());
revoke insert, update, delete on public.run_items from anon, authenticated;
revoke all on public.run_items from anon;

-- 4. Finish run: same as before, plus recording each bought item and the count.
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
    insert into public.run_items (run_id, kitchen_id, name, emoji, category, for_user, requested)
    values (run.id, k, g.name, g.emoji, g.category, coalesce(g.for_user, p_me), g.for_user is not null);
    r := public._restock(k, g.name, g.emoji, g.category, g.item_id, coalesce(g.for_user, p_me));
    names := names || g.name;
  end loop;
  update public.runs set item_count = cardinality(names) where id = run.id;
  update public.grocery set run_id = null where run_id = run.id;
  return public._event(k, 'run_ended', p_me, null,
    public._name(p_me) || ' is back from the shops',
    case when cardinality(names) = 0 then 'Nothing picked up this time.'
         else 'Picked up: ' || array_to_string(names[1:6], ', ') || case when cardinality(names) > 6 then '…' else '' end end);
end $$;

-- 5. Runs a profile has cleared from its own Recent runs (swipe left). Only hides it for
--    that profile, on every phone it uses; housemates still see it and nothing is deleted.
create table public.run_hidden (
  run_id uuid not null references public.runs on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  kitchen_id uuid not null references public.kitchens on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (run_id, member_id)
);
alter table public.run_hidden enable row level security;
create policy "read hidden runs" on public.run_hidden for select to authenticated using (kitchen_id = public.my_kitchen());
revoke insert, update, delete on public.run_hidden from anon, authenticated;
revoke all on public.run_hidden from anon;

create function public.hide_run(p_me uuid, p_run uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me);
begin
  if not exists (select 1 from public.runs where id = p_run and kitchen_id = k and ended_at is not null) then
    raise exception 'Run not found';
  end if;
  insert into public.run_hidden (run_id, member_id, kitchen_id) values (p_run, p_me, k) on conflict do nothing;
end $$;
revoke execute on function public.hide_run(uuid, uuid) from public, anon;
grant execute on function public.hide_run(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
