ALTER TABLE public.dishes
ADD COLUMN IF NOT EXISTS boost_score numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS boost_starts_at timestamptz,
ADD COLUMN IF NOT EXISTS boost_ends_at timestamptz;

ALTER TABLE public.dishes
DROP CONSTRAINT IF EXISTS dishes_boost_score_range;

ALTER TABLE public.dishes
ADD CONSTRAINT dishes_boost_score_range
CHECK (boost_score >= 0 AND boost_score <= 25);

ALTER TABLE public.dishes
DROP CONSTRAINT IF EXISTS dishes_boost_window_valid;

ALTER TABLE public.dishes
ADD CONSTRAINT dishes_boost_window_valid
CHECK (boost_ends_at IS NULL OR boost_starts_at IS NULL OR boost_ends_at > boost_starts_at);

CREATE INDEX IF NOT EXISTS idx_dishes_active_boost
ON public.dishes (boost_score DESC, boost_ends_at, trending_score DESC)
WHERE boost_score > 0 AND is_published = true;