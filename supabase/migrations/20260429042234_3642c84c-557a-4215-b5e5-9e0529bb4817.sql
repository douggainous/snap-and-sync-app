CREATE TABLE IF NOT EXISTS public.dish_trend_metrics (
  dish_id uuid PRIMARY KEY,
  window_started_at timestamp with time zone NOT NULL,
  window_ended_at timestamp with time zone NOT NULL DEFAULT now(),
  recent_save_count integer NOT NULL DEFAULT 0,
  recent_rating_count integer NOT NULL DEFAULT 0,
  recent_share_count integer NOT NULL DEFAULT 0,
  previous_save_count integer NOT NULL DEFAULT 0,
  previous_rating_count integer NOT NULL DEFAULT 0,
  previous_share_count integer NOT NULL DEFAULT 0,
  save_velocity numeric NOT NULL DEFAULT 0,
  rating_velocity numeric NOT NULL DEFAULT 0,
  share_velocity numeric NOT NULL DEFAULT 0,
  spike_score numeric NOT NULL DEFAULT 0,
  trend_score numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'normal',
  is_hot_nearby boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dish_trend_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published dish trend metrics" ON public.dish_trend_metrics;
CREATE POLICY "Anyone can view published dish trend metrics"
ON public.dish_trend_metrics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.dishes d
    WHERE d.id = dish_trend_metrics.dish_id
      AND d.is_published = true
  )
);

CREATE INDEX IF NOT EXISTS idx_dish_trend_metrics_status_score ON public.dish_trend_metrics (status, trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_dish_trend_metrics_hot_score ON public.dish_trend_metrics (is_hot_nearby, trend_score DESC);

CREATE TABLE IF NOT EXISTS public.dish_share_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL,
  user_id uuid,
  share_channel text NOT NULL DEFAULT 'native',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dish_share_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create dish share events" ON public.dish_share_events;
CREATE POLICY "Anyone can create dish share events"
ON public.dish_share_events
FOR INSERT
WITH CHECK (
  user_id IS NULL OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Anyone can view share events for published dishes" ON public.dish_share_events;
CREATE POLICY "Anyone can view share events for published dishes"
ON public.dish_share_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.dishes d
    WHERE d.id = dish_share_events.dish_id
      AND d.is_published = true
  )
);

CREATE INDEX IF NOT EXISTS idx_dish_share_events_dish_created ON public.dish_share_events (dish_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.refresh_dish_trend_metrics(_dish_id uuid)
RETURNS public.dish_trend_metrics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts timestamp with time zone := now();
  window_start timestamp with time zone := now() - interval '24 hours';
  previous_start timestamp with time zone := now() - interval '48 hours';
  recent_saves integer := 0;
  recent_ratings integer := 0;
  recent_shares integer := 0;
  previous_saves integer := 0;
  previous_ratings integer := 0;
  previous_shares integer := 0;
  save_v numeric := 0;
  rating_v numeric := 0;
  share_v numeric := 0;
  spike numeric := 0;
  score numeric := 0;
  next_status text := 'normal';
  next_hot boolean := false;
  result public.dish_trend_metrics;
BEGIN
  SELECT count(*)::integer INTO recent_saves
  FROM public.saved_items
  WHERE dish_id = _dish_id
    AND action_type IN ('saved', 'want_to_try', 'favorite')
    AND created_at >= window_start;

  SELECT count(*)::integer INTO previous_saves
  FROM public.saved_items
  WHERE dish_id = _dish_id
    AND action_type IN ('saved', 'want_to_try', 'favorite')
    AND created_at >= previous_start
    AND created_at < window_start;

  SELECT count(*)::integer INTO recent_ratings
  FROM public.ratings
  WHERE dish_id = _dish_id
    AND created_at >= window_start;

  SELECT count(*)::integer INTO previous_ratings
  FROM public.ratings
  WHERE dish_id = _dish_id
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

  save_v := recent_saves - previous_saves;
  rating_v := recent_ratings - previous_ratings;
  share_v := recent_shares - previous_shares;
  spike := greatest(0, save_v) * 2 + greatest(0, rating_v) * 3 + greatest(0, share_v) * 4;
  score := recent_saves * 2 + recent_ratings * 3 + recent_shares * 4 + spike;

  IF score >= 36 AND (recent_shares >= 5 OR spike >= 18) THEN
    next_status := 'viral';
  ELSIF score >= 12 OR spike >= 8 THEN
    next_status := 'trending';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.dishes d
    JOIN public.restaurants r ON r.id = d.restaurant_id
    WHERE d.id = _dish_id
      AND d.is_published = true
      AND next_status IN ('trending', 'viral')
      AND r.latitude IS NOT NULL
      AND r.longitude IS NOT NULL
  ) INTO next_hot;

  INSERT INTO public.dish_trend_metrics (
    dish_id, window_started_at, window_ended_at,
    recent_save_count, recent_rating_count, recent_share_count,
    previous_save_count, previous_rating_count, previous_share_count,
    save_velocity, rating_velocity, share_velocity,
    spike_score, trend_score, status, is_hot_nearby, updated_at
  ) VALUES (
    _dish_id, window_start, now_ts,
    recent_saves, recent_ratings, recent_shares,
    previous_saves, previous_ratings, previous_shares,
    save_v, rating_v, share_v,
    spike, score, next_status, next_hot, now_ts
  )
  ON CONFLICT (dish_id) DO UPDATE SET
    window_started_at = EXCLUDED.window_started_at,
    window_ended_at = EXCLUDED.window_ended_at,
    recent_save_count = EXCLUDED.recent_save_count,
    recent_rating_count = EXCLUDED.recent_rating_count,
    recent_share_count = EXCLUDED.recent_share_count,
    previous_save_count = EXCLUDED.previous_save_count,
    previous_rating_count = EXCLUDED.previous_rating_count,
    previous_share_count = EXCLUDED.previous_share_count,
    save_velocity = EXCLUDED.save_velocity,
    rating_velocity = EXCLUDED.rating_velocity,
    share_velocity = EXCLUDED.share_velocity,
    spike_score = EXCLUDED.spike_score,
    trend_score = EXCLUDED.trend_score,
    status = EXCLUDED.status,
    is_hot_nearby = EXCLUDED.is_hot_nearby,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_dish_trend_metrics_from_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_dish_trend_metrics(OLD.dish_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_dish_trend_metrics(NEW.dish_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_trends_from_saved_items ON public.saved_items;
CREATE TRIGGER refresh_trends_from_saved_items
AFTER INSERT OR UPDATE OR DELETE ON public.saved_items
FOR EACH ROW EXECUTE FUNCTION public.refresh_dish_trend_metrics_from_row();

DROP TRIGGER IF EXISTS refresh_trends_from_ratings ON public.ratings;
CREATE TRIGGER refresh_trends_from_ratings
AFTER INSERT OR UPDATE OR DELETE ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.refresh_dish_trend_metrics_from_row();

DROP TRIGGER IF EXISTS refresh_trends_from_shares ON public.dish_share_events;
CREATE TRIGGER refresh_trends_from_shares
AFTER INSERT OR UPDATE OR DELETE ON public.dish_share_events
FOR EACH ROW EXECUTE FUNCTION public.refresh_dish_trend_metrics_from_row();