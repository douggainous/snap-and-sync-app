ALTER TABLE public.collection_dishes
  DROP CONSTRAINT IF EXISTS collection_dishes_dish_id_fkey;

ALTER TABLE public.collection_dishes
  ADD CONSTRAINT collection_dishes_dish_id_fkey
  FOREIGN KEY (dish_id)
  REFERENCES public.dishes(id)
  ON DELETE CASCADE;