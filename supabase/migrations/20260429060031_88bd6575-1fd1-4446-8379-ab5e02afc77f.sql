DROP TRIGGER IF EXISTS refresh_trends_from_saved_items ON public.saved_items;
DROP TRIGGER IF EXISTS refresh_trends_from_ratings ON public.ratings;
DROP TRIGGER IF EXISTS refresh_trends_from_shares ON public.dish_share_events;

DROP INDEX IF EXISTS public.idx_dish_share_events_dish_created;
DROP INDEX IF EXISTS public.idx_ratings_dish_created;
DROP INDEX IF EXISTS public.dish_trend_metrics_dish_id_key;
DROP INDEX IF EXISTS public.idx_dish_trend_metrics_status_updated;
DROP INDEX IF EXISTS public.idx_dish_tags_dish_id;
DROP INDEX IF EXISTS public.idx_dish_tags_tag_id;