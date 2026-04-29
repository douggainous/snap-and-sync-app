CREATE TABLE IF NOT EXISTS public.dish_sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL,
  sponsor_name text,
  label text NOT NULL DEFAULT 'Sponsored',
  boost_score numeric NOT NULL DEFAULT 0,
  target_cuisine text,
  target_city text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dish_sponsorships_boost_score_range CHECK (boost_score >= 0 AND boost_score <= 25),
  CONSTRAINT dish_sponsorships_label_length CHECK (char_length(label) BETWEEN 1 AND 40),
  CONSTRAINT dish_sponsorships_sponsor_name_length CHECK (sponsor_name IS NULL OR char_length(sponsor_name) <= 120),
  CONSTRAINT dish_sponsorships_target_cuisine_length CHECK (target_cuisine IS NULL OR char_length(target_cuisine) <= 80),
  CONSTRAINT dish_sponsorships_target_city_length CHECK (target_city IS NULL OR char_length(target_city) <= 120)
);

ALTER TABLE public.dish_sponsorships ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_dish_sponsorships_active_dish
ON public.dish_sponsorships (dish_id, starts_at DESC)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_dish_sponsorships_active_targeting
ON public.dish_sponsorships (target_cuisine, target_city, boost_score DESC)
WHERE is_active = true;

DROP TRIGGER IF EXISTS update_dish_sponsorships_updated_at ON public.dish_sponsorships;
CREATE TRIGGER update_dish_sponsorships_updated_at
BEFORE UPDATE ON public.dish_sponsorships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Anyone can view active sponsorships for published dishes" ON public.dish_sponsorships;
CREATE POLICY "Anyone can view active sponsorships for published dishes"
ON public.dish_sponsorships
FOR SELECT
USING (
  is_active = true
  AND starts_at <= now()
  AND (ends_at IS NULL OR ends_at > now())
  AND EXISTS (
    SELECT 1 FROM public.dishes d
    WHERE d.id = dish_sponsorships.dish_id
      AND d.is_published = true
  )
);