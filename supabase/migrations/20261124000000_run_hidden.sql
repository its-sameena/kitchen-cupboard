-- Let each profile clear runs from its own Recent runs list (swipe left).
-- Additive only: a new table and a new function. Nothing existing is changed.

-- Runs a profile has cleared from its own Recent runs (swipe left). Only hides it for
-- that profile, on every phone it uses; housemates still see it and nothing is deleted.
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
