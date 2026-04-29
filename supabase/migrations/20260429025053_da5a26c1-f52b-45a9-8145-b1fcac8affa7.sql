ALTER TABLE public.dishes
  ALTER COLUMN restaurant_id DROP NOT NULL;

DROP INDEX IF EXISTS dishes_restaurant_slug_unique_idx;

CREATE UNIQUE INDEX dishes_restaurant_slug_unique_idx
ON public.dishes (restaurant_id, slug)
WHERE restaurant_id IS NOT NULL;

CREATE UNIQUE INDEX dishes_creator_slug_without_restaurant_unique_idx
ON public.dishes (created_by, slug)
WHERE restaurant_id IS NULL AND created_by IS NOT NULL;
