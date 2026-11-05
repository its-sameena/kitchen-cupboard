-- Optional DiceBear "sprouts" avatar per profile.
-- Stored as the chosen parts/colours, e.g.
-- {"plant":"cactus","pot":"bowl","pattern":null,"cheeks":"blush","eyes":"happy","mouth":"grin",
--  "potColor":"#fca5a5","plantColor":"#22c55e","bloomColor":"#fcd34d"}
-- NULL means "no avatar": the app shows initials. The background is always the profile colour.

alter table public.members
  add column avatar jsonb
  check (avatar is null or (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) <= 1024));

grant update (avatar) on public.members to authenticated;

-- Tell the Supabase API to pick up the new column straight away.
notify pgrst, 'reload schema';
