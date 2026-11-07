-- New "Cereals" shelf (feedback be524ce4).

-- 1. Allow the new shelf id on cupboard items (grocery.category has no check).
alter table public.items drop constraint if exists items_category_check;
alter table public.items add constraint items_category_check check (category in (
  'spices','dairy','cold','frozen','drinks','baking','coffee','cereals','grains','canned','sauces','snacks','produce','other'));

-- 2. Move obvious cereals that the old guesser put on "Pasta, Rice & Grains",
--    unless an item with the same name is already on the Cereals shelf.
update public.items i set category = 'cereals', updated_at = now()
 where i.category = 'grains'
   and lower(i.name) ~ '(^|[^a-z])(cereals?|oats?|porridge|granola|muesli|corn ?flakes|bran flakes|weetabix|shreddies|cheerios|rice krispies|coco pops|frosties)([^a-z]|$)'
   and not exists (select 1 from public.items j
                    where j.kitchen_id = i.kitchen_id and j.category = 'cereals' and lower(j.name) = lower(i.name));

update public.grocery g set category = 'cereals'
  from public.items i
 where g.item_id = i.id and i.category = 'cereals' and g.category = 'grains';

notify pgrst, 'reload schema';
