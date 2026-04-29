ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS matched_existing_dish_id uuid,
ADD COLUMN IF NOT EXISTS dish_match_status text NOT NULL DEFAULT 'not_checked',
ADD COLUMN IF NOT EXISTS dish_match_score numeric,
ADD COLUMN IF NOT EXISTS dish_match_reasons text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_photos_matched_existing_dish_id ON public.photos(matched_existing_dish_id);
CREATE INDEX IF NOT EXISTS idx_photos_dish_match_status ON public.photos(dish_match_status);

CREATE TABLE IF NOT EXISTS public.dish_match_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  photo_id uuid NOT NULL,
  original_dish_id uuid NOT NULL,
  override_dish_id uuid NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dish_match_overrides ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_dish_match_overrides_user_id ON public.dish_match_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_dish_match_overrides_photo_id ON public.dish_match_overrides(photo_id);

CREATE POLICY "Users can create their dish match overrides"
ON public.dish_match_overrides
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their dish match overrides"
ON public.dish_match_overrides
FOR SELECT
TO authenticated
USING (user_id = auth.uid());