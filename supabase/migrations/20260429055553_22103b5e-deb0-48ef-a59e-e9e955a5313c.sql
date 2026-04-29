-- Ensure one trend metric row per dish for fast upserts
CREATE UNIQUE INDEX IF NOT EXISTS dish_trend_metrics_dish_id_key
ON public.dish_trend_metrics (dish_id);

-- Add additional precomputed velocity fields without changing existing consumers
ALTER TABLE public.dish_trend_metrics
  ADD COLUMN IF NOT EXISTS recent_favorite_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recent_review_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_favorite_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_review_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS favorite_velocity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_velocity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS location_spike_score numeric NOT NULL DEFAULT 0;

-- Store trend snapshots so the product can inspect velocity over time without recomputing from raw events
CREATE TABLE IF NOT EXISTS public.dish_trend_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dish_id uuid NOT NULL,
  window_started_at timestamp with time zone NOT NULL,
  window_ended_at timestamp with time zone NOT NULL DEFAULT now(),
  recent_save_count integer NOT NULL DEFAULT 0,
  recent_favorite_count integer NOT NULL DEFAULT 0,
  recent_rating_count integer NOT NULL DEFAULT 0,
  recent_review_count integer NOT NULL DEFAULT 0,
  recent_share_count integer NOT NULL DEFAULT 0,
  save_velocity numeric NOT NULL DEFAULT 0,
  favorite_velocity numeric NOT NULL DEFAULT 0,
  rating_velocity numeric NOT NULL DEFAULT 0,
  review_velocity numeric NOT NULL DEFAULT 0,
  share_velocity numeric NOT NULL DEFAULT 0,
  spike_score numeric NOT NULL DEFAULT 0,
  location_spike_score numeric NOT NULL DEFAULT 0,
  trend_score numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'normal',
  is_hot_nearby boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dish_trend_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dish_trend_snapshots'
      AND policyname = 'Anyone can view published dish trend snapshots'
  ) THEN
    CREATE POLICY "Anyone can view published dish trend snapshots"
    ON public.dish_trend_snapshots
    FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.dishes d
      WHERE d.id = dish_trend_snapshots.dish_id
        AND d.is_published = true
    ));
  END IF;
END $$;

-- Indexed recent-event lookups used by the trend refresher
CREATE INDEX IF NOT EXISTS idx_saved_items_dish_action_created
ON public.saved_items (dish_id, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ratings_dish_created_public
ON public.ratings (dish_id, created_at DESC)
WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_reviews_dish_created_public
ON public.reviews (dish_id, created_at DESC)
WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_share_events_dish_created
ON public.dish_share_events (dish_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dish_trend_metrics_status_score
ON public.dish_trend_metrics (status, trend_score DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_dish_trend_snapshots_dish_created
ON public.dish_trend_snapshots (dish_id, created_at DESC);

-- Performance-safe trend refresh: bounded windows over indexed event tables, then persisted metrics
CREATE OR REPLACE FUNCTION public.refresh_dish_trend_metrics(_dish_id uuid)
RETURNS public.dish_trend_metrics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  now_ts timestamp with time zone := now();
  window_start timestamp with time zone := now() - interval '6 hours';
  previous_start timestamp with time zone := now() - interval '12 hours';
  recent_saves integer := 0;
  recent_favorites integer := 0;
  recent_ratings integer := 0;
  recent_reviews integer := 0;
  recent_shares integer := 0;
  previous_saves integer := 0;
  previous_favorites integer := 0;
  previous_ratings integer := 0;
  previous_reviews integer := 0;
  previous_shares integer := 0;
  save_v numeric := 0;
  favorite_v numeric := 0;
  rating_v numeric := 0;
  review_v numeric := 0;
  share_v numeric := 0;
  spike numeric := 0;
  location_spike numeric := 0;
  score numeric := 0;
  next_status text := 'normal';
  next_hot boolean := false;
  has_location boolean := false;
  result public.dish_trend_metrics;
BEGIN
  SELECT count(*)::integer INTO recent_saves
  FROM public.saved_items
  WHERE dish_id = _dish_id
    AND action_type IN ('saved', 'want_to_try')
    AND created_at >= window_start;

  SELECT count(*)::integer INTO previous_saves
  FROM public.saved_items
  WHERE dish_id = _dish_id
    AND action_type IN ('saved', 'want_to_try')
    AND created_at >= previous_start
    AND created_at < window_start;

  SELECT count(*)::integer INTO recent_favorites
  FROM public.saved_items
  WHERE dish_id = _dish_id
    AND action_type = 'favorite'
    AND created_at >= window_start;

  SELECT count(*)::integer INTO previous_favorites
  FROM public.saved_items
  WHERE dish_id = _dish_id
    AND action_type = 'favorite'
    AND created_at >= previous_start
    AND created_at < window_start;

  SELECT count(*)::integer INTO recent_ratings
  FROM public.ratings
  WHERE dish_id = _dish_id
    AND is_public = true
    AND created_at >= window_start;

  SELECT count(*)::integer INTO previous_ratings
  FROM public.ratings
  WHERE dish_id = _dish_id
    AND is_public = true
    AND created_at >= previous_start
    AND created_at < window_start;

  SELECT count(*)::integer INTO recent_reviews
  FROM public.reviews
  WHERE dish_id = _dish_id
    AND is_public = true
    AND created_at >= window_start;

  SELECT count(*)::integer INTO previous_reviews
  FROM public.reviews
  WHERE dish_id = _dish_id
    AND is_public = true
    AND created_at >= previous_start
    AND created_at < window_start;

  SELECT count(*)::integer INTO recent_shares
  FROM public.dish_share_events
  WHERE dish_id = _dish_id
    AND created_at >= window_start;

  SELECT count(*)::integer INTO previous_shares
  FROM public.dish_share_events
  WHERE dish_id = _dish_id
    AND created_at >= previous_start
    AND created_at < window_start;

  SELECT EXISTS (
    SELECT 1
    FROM public.dishes d
    JOIN public.restaurants r ON r.id = d.restaurant_id
    WHERE d.id = _dish_id
      AND d.is_published = true
      AND r.latitude IS NOT NULL
      AND r.longitude IS NOT NULL
  ) INTO has_location;

  save_v := recent_saves - previous_saves;
  favorite_v := recent_favorites - previous_favorites;
  rating_v := recent_ratings - previous_ratings;
  review_v := recent_reviews - previous_reviews;
  share_v := recent_shares - previous_shares;

  spike := greatest(0, save_v) * 2
    + greatest(0, favorite_v) * 4
    + greatest(0, rating_v) * 3
    + greatest(0, review_v) * 3
    + greatest(0, share_v) * 5;

  location_spike := CASE WHEN has_location THEN spike ELSE 0 END;

  score := recent_saves * 2
    + recent_favorites * 4
    + recent_ratings * 3
    + recent_reviews * 3
    + recent_shares * 5
    + spike * 1.5
    + CASE WHEN has_location THEN greatest(0, spike) ELSE 0 END;

  IF score >= 48 AND (recent_shares >= 4 OR recent_favorites >= 5 OR spike >= 22) THEN
    next_status := 'viral';
  ELSIF score >= 16 OR spike >= 10 OR (recent_ratings + recent_reviews >= 4) THEN
    next_status := 'trending';
  END IF;

  next_hot := has_location AND next_status IN ('trending', 'viral') AND (location_spike >= 10 OR score >= 20);

  INSERT INTO public.dish_trend_metrics (
    dish_id, window_started_at, window_ended_at,
    recent_save_count, recent_favorite_count, recent_rating_count, recent_review_count, recent_share_count,
    previous_save_count, previous_favorite_count, previous_rating_count, previous_review_count, previous_share_count,
    save_velocity, favorite_velocity, rating_velocity, review_velocity, share_velocity,
    spike_score, location_spike_score, trend_score, status, is_hot_nearby, updated_at
  ) VALUES (
    _dish_id, window_start, now_ts,
    recent_saves, recent_favorites, recent_ratings, recent_reviews, recent_shares,
    previous_saves, previous_favorites, previous_ratings, previous_reviews, previous_shares,
    save_v, favorite_v, rating_v, review_v, share_v,
    spike, location_spike, score, next_status, next_hot, now_ts
  )
  ON CONFLICT (dish_id) DO UPDATE SET
    window_started_at = EXCLUDED.window_started_at,
    window_ended_at = EXCLUDED.window_ended_at,
    recent_save_count = EXCLUDED.recent_save_count,
    recent_favorite_count = EXCLUDED.recent_favorite_count,
    recent_rating_count = EXCLUDED.recent_rating_count,
    recent_review_count = EXCLUDED.recent_review_count,
    recent_share_count = EXCLUDED.recent_share_count,
    previous_save_count = EXCLUDED.previous_save_count,
    previous_favorite_count = EXCLUDED.previous_favorite_count,
    previous_rating_count = EXCLUDED.previous_rating_count,
    previous_review_count = EXCLUDED.previous_review_count,
    previous_share_count = EXCLUDED.previous_share_count,
    save_velocity = EXCLUDED.save_velocity,
    favorite_velocity = EXCLUDED.favorite_velocity,
    rating_velocity = EXCLUDED.rating_velocity,
    review_velocity = EXCLUDED.review_velocity,
    share_velocity = EXCLUDED.share_velocity,
    spike_score = EXCLUDED.spike_score,
    location_spike_score = EXCLUDED.location_spike_score,
    trend_score = EXCLUDED.trend_score,
    status = EXCLUDED.status,
    is_hot_nearby = EXCLUDED.is_hot_nearby,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO result;

  INSERT INTO public.dish_trend_snapshots (
    dish_id, window_started_at, window_ended_at,
    recent_save_count, recent_favorite_count, recent_rating_count, recent_review_count, recent_share_count,
    save_velocity, favorite_velocity, rating_velocity, review_velocity, share_velocity,
    spike_score, location_spike_score, trend_score, status, is_hot_nearby
  ) VALUES (
    _dish_id, window_start, now_ts,
    recent_saves, recent_favorites, recent_ratings, recent_reviews, recent_shares,
    save_v, favorite_v, rating_v, review_v, share_v,
    spike, location_spike, score, next_status, next_hot
  );

  DELETE FROM public.dish_trend_snapshots
  WHERE dish_id = _dish_id
    AND created_at < now_ts - interval '14 days';

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_dish_trend_metrics_from_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_dish_id uuid;
BEGIN
  target_dish_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.dish_id ELSE NEW.dish_id END;
  IF target_dish_id IS NOT NULL THEN
    PERFORM public.refresh_dish_trend_metrics(target_dish_id);
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

-- Refresh trend metrics when real engagement changes. These are bounded, indexed refreshes per affected dish.
DROP TRIGGER IF EXISTS refresh_dish_trends_on_saved_items ON public.saved_items;
CREATE TRIGGER refresh_dish_trends_on_saved_items
AFTER INSERT OR UPDATE OR DELETE ON public.saved_items
FOR EACH ROW
EXECUTE FUNCTION public.refresh_dish_trend_metrics_from_row();

DROP TRIGGER IF EXISTS refresh_dish_trends_on_ratings ON public.ratings;
CREATE TRIGGER refresh_dish_trends_on_ratings
AFTER INSERT OR UPDATE OR DELETE ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.refresh_dish_trend_metrics_from_row();

DROP TRIGGER IF EXISTS refresh_dish_trends_on_reviews ON public.reviews;
CREATE TRIGGER refresh_dish_trends_on_reviews
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.refresh_dish_trend_metrics_from_row();

DROP TRIGGER IF EXISTS refresh_dish_trends_on_share_events ON public.dish_share_events;
CREATE TRIGGER refresh_dish_trends_on_share_events
AFTER INSERT OR DELETE ON public.dish_share_events
FOR EACH ROW
EXECUTE FUNCTION public.refresh_dish_trend_metrics_from_row();