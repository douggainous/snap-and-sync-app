DROP TRIGGER IF EXISTS sync_dish_rollups_from_ratings ON public.ratings;
DROP TRIGGER IF EXISTS sync_dish_rollups_from_reviews ON public.reviews;
DROP TRIGGER IF EXISTS sync_dish_rollups_from_photos ON public.photos;
DROP TRIGGER IF EXISTS sync_dish_rollups_from_saved_items ON public.saved_items;

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