ALTER TABLE public.favorite_list_items
ADD COLUMN IF NOT EXISTS dish_id uuid;

ALTER TABLE public.favorite_list_items
ALTER COLUMN menu_item_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dishes_restaurant_id_fkey') THEN
    ALTER TABLE public.dishes ADD CONSTRAINT dishes_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dishes_created_by_fkey') THEN
    ALTER TABLE public.dishes ADD CONSTRAINT dishes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_created_by_fkey') THEN
    ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_dish_id_fkey') THEN
    ALTER TABLE public.photos ADD CONSTRAINT photos_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_user_id_fkey') THEN
    ALTER TABLE public.photos ADD CONSTRAINT photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_review_id_fkey') THEN
    ALTER TABLE public.photos ADD CONSTRAINT photos_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ratings_dish_id_fkey') THEN
    ALTER TABLE public.ratings ADD CONSTRAINT ratings_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ratings_user_id_fkey') THEN
    ALTER TABLE public.ratings ADD CONSTRAINT ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_dish_id_fkey') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_user_id_fkey') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_rating_id_fkey') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_rating_id_fkey FOREIGN KEY (rating_id) REFERENCES public.ratings(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_items_dish_id_fkey') THEN
    ALTER TABLE public.saved_items ADD CONSTRAINT saved_items_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_items_user_id_fkey') THEN
    ALTER TABLE public.saved_items ADD CONSTRAINT saved_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dish_tags_dish_id_fkey') THEN
    ALTER TABLE public.dish_tags ADD CONSTRAINT dish_tags_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dish_tags_tag_id_fkey') THEN
    ALTER TABLE public.dish_tags ADD CONSTRAINT dish_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dish_tags_created_by_fkey') THEN
    ALTER TABLE public.dish_tags ADD CONSTRAINT dish_tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorite_lists_user_id_fkey') THEN
    ALTER TABLE public.favorite_lists ADD CONSTRAINT favorite_lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorite_list_items_list_id_fkey') THEN
    ALTER TABLE public.favorite_list_items ADD CONSTRAINT favorite_list_items_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.favorite_lists(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorite_list_items_dish_id_fkey') THEN
    ALTER TABLE public.favorite_list_items ADD CONSTRAINT favorite_list_items_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorite_list_items_unique_dish') THEN
    ALTER TABLE public.favorite_list_items ADD CONSTRAINT favorite_list_items_unique_dish UNIQUE (list_id, dish_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS sync_dish_rollups_ratings ON public.ratings;
CREATE TRIGGER sync_dish_rollups_ratings
AFTER INSERT OR UPDATE OR DELETE ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.sync_dish_rollups_from_child();

DROP TRIGGER IF EXISTS sync_dish_rollups_reviews ON public.reviews;
CREATE TRIGGER sync_dish_rollups_reviews
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.sync_dish_rollups_from_child();

DROP TRIGGER IF EXISTS sync_dish_rollups_photos ON public.photos;
CREATE TRIGGER sync_dish_rollups_photos
AFTER INSERT OR UPDATE OR DELETE ON public.photos
FOR EACH ROW EXECUTE FUNCTION public.sync_dish_rollups_from_child();

DROP TRIGGER IF EXISTS sync_dish_rollups_saved_items ON public.saved_items;
CREATE TRIGGER sync_dish_rollups_saved_items
AFTER INSERT OR UPDATE OR DELETE ON public.saved_items
FOR EACH ROW EXECUTE FUNCTION public.sync_dish_rollups_from_child();

CREATE INDEX IF NOT EXISTS favorite_list_items_dish_id_idx ON public.favorite_list_items (dish_id);
CREATE INDEX IF NOT EXISTS favorite_list_items_list_dish_idx ON public.favorite_list_items (list_id, dish_id);