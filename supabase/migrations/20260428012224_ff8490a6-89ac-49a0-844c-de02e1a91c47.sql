REVOKE ALL ON FUNCTION public.refresh_menu_item_rating(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_menu_item_rating(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_menu_item_rating(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.sync_menu_item_review_rollup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_menu_item_review_rollup() FROM anon;
REVOKE ALL ON FUNCTION public.sync_menu_item_review_rollup() FROM authenticated;