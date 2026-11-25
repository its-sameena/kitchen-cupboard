-- Toolbox: the house's shared things and who has them, plus how they've been passed around.
-- Additive only: two new tables and four new functions. Nothing existing is changed.

-- 1. Shared things. holder NULL = Elsewhere (not with anyone in the house).
create table public.toolbox_things (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  -- Item icon key (src/catalog/item-icons.ts).
  icon text not null default 'package' check (char_length(icon) <= 24),
  -- Deleting a profile sends what it held to Elsewhere.
  holder uuid references public.members on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index toolbox_things_kitchen on public.toolbox_things (kitchen_id);

-- 2. Handover history. by = who made the change (the only one who may undo it).
create table public.toolbox_handovers (
  id uuid primary key default gen_random_uuid(),
  thing_id uuid not null references public.toolbox_things on delete cascade,
  kitchen_id uuid not null references public.kitchens on delete cascade,
  from_holder uuid,
  to_holder uuid,
  by_member uuid not null,
  added boolean not null default false,
  undone boolean not null default false,
  at timestamptz not null default now()
);
create index toolbox_handovers_thing on public.toolbox_handovers (thing_id, at desc);

-- 3. Read your own kitchen's; every change goes through the functions below.
alter table public.toolbox_things enable row level security;
alter table public.toolbox_handovers enable row level security;
create policy "read toolbox things" on public.toolbox_things for select to authenticated using (kitchen_id = public.my_kitchen());
create policy "read toolbox handovers" on public.toolbox_handovers for select to authenticated using (kitchen_id = public.my_kitchen());
revoke insert, update, delete on public.toolbox_things, public.toolbox_handovers from anon, authenticated;
revoke all on public.toolbox_things, public.toolbox_handovers from anon;

-- A holder must be a profile in this kitchen (NULL = Elsewhere is always fine).
create function public._toolbox_holder_ok(k uuid, h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select h is null or exists (select 1 from public.members where id = h and kitchen_id = k)
$$;

-- 4. Add a thing (it starts with p_holder).
create function public.add_thing(p_me uuid, p_name text, p_icon text, p_holder uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me); t uuid;
begin
  if not public._toolbox_holder_ok(k, p_holder) then raise exception 'That housemate isn’t in this kitchen'; end if;
  insert into public.toolbox_things (kitchen_id, name, icon, holder, created_by)
  values (k, trim(p_name), coalesce(nullif(p_icon, ''), 'package'), p_holder, p_me) returning id into t;
  insert into public.toolbox_handovers (thing_id, kitchen_id, from_holder, to_holder, by_member, added)
  values (t, k, null, p_holder, p_me, true);
  return t;
end $$;

-- 5. Say who has it now ("I have this" = p_to is me; "Someone else has it"; NULL = Elsewhere).
create function public.hand_over(p_me uuid, p_thing uuid, p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me); cur uuid;
begin
  select holder into cur from public.toolbox_things where id = p_thing and kitchen_id = k for update;
  if not found then raise exception 'Thing not found'; end if;
  if not public._toolbox_holder_ok(k, p_to) then raise exception 'That housemate isn’t in this kitchen'; end if;
  if cur is not distinct from p_to then return; end if;
  update public.toolbox_things set holder = p_to, updated_at = now() where id = p_thing;
  insert into public.toolbox_handovers (thing_id, kitchen_id, from_holder, to_holder, by_member)
  values (p_thing, k, cur, p_to, p_me);
end $$;

-- 6. Undo: only your own latest change, only while it's still the current state.
--    Gives the thing back to whoever had it before.
create function public.undo_handover(p_me uuid, p_thing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me); h public.toolbox_handovers; cur uuid;
begin
  select holder into cur from public.toolbox_things where id = p_thing and kitchen_id = k for update;
  if not found then raise exception 'Thing not found'; end if;
  select * into h from public.toolbox_handovers
   where thing_id = p_thing and not undone order by at desc, id desc limit 1;
  if h.id is null or h.added or h.by_member <> p_me or h.to_holder is distinct from cur then
    raise exception 'Only the last change, by whoever made it, can be undone';
  end if;
  update public.toolbox_handovers set undone = true where id = h.id;
  update public.toolbox_things
     set holder = case when public._toolbox_holder_ok(k, h.from_holder) then h.from_holder else null end,
         updated_at = now()
   where id = p_thing;
end $$;

-- 7. Remove a thing (and its history) for everyone.
create function public.remove_thing(p_me uuid, p_thing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k uuid := public._check(p_me);
begin
  delete from public.toolbox_things where id = p_thing and kitchen_id = k;
  if not found then raise exception 'Thing not found'; end if;
end $$;

revoke execute on function public._toolbox_holder_ok(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.add_thing(uuid, text, text, uuid), public.hand_over(uuid, uuid, uuid),
  public.undo_handover(uuid, uuid), public.remove_thing(uuid, uuid) from public, anon;
grant execute on function public.add_thing(uuid, text, text, uuid), public.hand_over(uuid, uuid, uuid),
  public.undo_handover(uuid, uuid), public.remove_thing(uuid, uuid) to authenticated;

-- 8. Live updates on every phone.
alter publication supabase_realtime add table public.toolbox_things, public.toolbox_handovers;

notify pgrst, 'reload schema';
