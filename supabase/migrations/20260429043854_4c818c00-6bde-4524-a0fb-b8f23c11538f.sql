CREATE INDEX IF NOT EXISTS idx_dishes_published_trending_created
ON public.dishes (is_published, trending_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dishes_published_rating_count
ON public.dishes (is_published, aggregate_rating DESC, rating_count DESC);

CREATE INDEX IF NOT EXISTS idx_dishes_published_cuisine
ON public.dishes (is_published, cuisine);

CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_id
ON public.dishes (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_dishes_search_vector
ON public.dishes USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_restaurants_search_vector
ON public.restaurants USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_restaurants_location
ON public.restaurants (latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_photos_public_dish_created
ON public.photos (dish_id, is_public, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_items_user_action_updated
ON public.saved_items (user_id, action_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_items_dish_action_created
ON public.saved_items (dish_id, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ratings_user_updated
ON public.ratings (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ratings_dish_created
ON public.ratings (dish_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dish_tags_dish_id
ON public.dish_tags (dish_id);

CREATE INDEX IF NOT EXISTS idx_dish_tags_tag_id
ON public.dish_tags (tag_id);

CREATE INDEX IF NOT EXISTS idx_dish_trend_metrics_status_updated
ON public.dish_trend_metrics (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_favorite_list_items_list_sort
ON public.favorite_list_items (list_id, sort_order, created_at DESC);