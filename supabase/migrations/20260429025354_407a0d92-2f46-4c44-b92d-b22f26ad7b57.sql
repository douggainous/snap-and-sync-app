CREATE INDEX IF NOT EXISTS saved_items_dish_favorite_idx
ON public.saved_items (dish_id, action_type)
WHERE action_type IN ('want_to_try', 'favorite');

CREATE OR REPLACE FUNCTION public.refresh_dish_rollups(_dish_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.dishes
  SET
    aggregate_rating = COALESCE((
      SELECT round(avg(r.rating)::numeric, 2)
      FROM public.ratings r
      WHERE r.dish_id = _dish_id AND r.is_public = true
    ), 0),
    rating_count = (
      SELECT count(*)::integer
      FROM public.ratings r
      WHERE r.dish_id = _dish_id AND r.is_public = true
    ),
    review_count = (
      SELECT count(*)::integer
      FROM public.reviews rv
      WHERE rv.dish_id = _dish_id AND rv.is_public = true
    ),
    photo_count = (
      SELECT count(*)::integer
      FROM public.photos p
      WHERE p.dish_id = _dish_id AND p.is_public = true
    ),
    save_count = (
      SELECT count(*)::integer
      FROM public.saved_items s
      WHERE s.dish_id = _dish_id AND s.action_type = 'saved'
    ),
    want_to_try_count = (
      SELECT count(*)::integer
      FROM public.saved_items s
      WHERE s.dish_id = _dish_id AND s.action_type = 'want_to_try'
    ),
    like_count = (
      SELECT count(*)::integer
      FROM public.saved_items s
      WHERE s.dish_id = _dish_id AND s.action_type = 'liked'
    ),
    favorite_count = (
      SELECT count(*)::integer
      FROM public.saved_items s
      WHERE s.dish_id = _dish_id AND s.action_type = 'favorite'
    ),
    trending_score = (
      COALESCE((SELECT avg(r.rating)::numeric FROM public.ratings r WHERE r.dish_id = _dish_id AND r.is_public = true), 0) * 20
      + COALESCE((SELECT count(*)::numeric FROM public.reviews rv WHERE rv.dish_id = _dish_id AND rv.is_public = true), 0) * 4
      + COALESCE((SELECT count(*)::numeric FROM public.photos p WHERE p.dish_id = _dish_id AND p.is_public = true), 0) * 3
      + COALESCE((SELECT count(*)::numeric FROM public.saved_items s WHERE s.dish_id = _dish_id AND s.action_type IN ('saved', 'want_to_try', 'favorite')), 0) * 2
      + COALESCE((SELECT count(*)::numeric FROM public.saved_items s WHERE s.dish_id = _dish_id AND s.action_type = 'liked'), 0)
    ),
    updated_at = now()
  WHERE id = _dish_id;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_dish_rollups(UUID) FROM PUBLIC, anon, authenticated;
