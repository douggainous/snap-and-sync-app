CREATE TABLE IF NOT EXISTS public.dish_ai_recognitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dish_id uuid,
  photo_id uuid,
  image_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  dish_name text,
  cuisine text,
  tags text[] NOT NULL DEFAULT '{}',
  ingredients text[] NOT NULL DEFAULT '{}',
  confidence numeric,
  confidence_level text NOT NULL DEFAULT 'low',
  raw_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dish_ai_recognitions_status_allowed CHECK (status IN ('pending', 'completed', 'failed', 'rate_limited', 'payment_required')),
  CONSTRAINT dish_ai_recognitions_confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT dish_ai_recognitions_confidence_level_allowed CHECK (confidence_level IN ('high', 'medium', 'low')),
  CONSTRAINT dish_ai_recognitions_image_hash_length CHECK (char_length(image_hash) BETWEEN 32 AND 160)
);

ALTER TABLE public.dish_ai_recognitions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dish_ai_recognitions_image_hash ON public.dish_ai_recognitions (image_hash);
CREATE INDEX IF NOT EXISTS idx_dish_ai_recognitions_dish_updated ON public.dish_ai_recognitions (dish_id, updated_at DESC) WHERE dish_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dish_ai_recognitions_user_updated ON public.dish_ai_recognitions (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS update_dish_ai_recognitions_updated_at ON public.dish_ai_recognitions;
CREATE TRIGGER update_dish_ai_recognitions_updated_at
BEFORE UPDATE ON public.dish_ai_recognitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can create their recognition cache rows" ON public.dish_ai_recognitions;
CREATE POLICY "Users can create their recognition cache rows"
ON public.dish_ai_recognitions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their recognition cache rows" ON public.dish_ai_recognitions;
CREATE POLICY "Users can view their recognition cache rows"
ON public.dish_ai_recognitions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can view completed recognition for published dishes" ON public.dish_ai_recognitions;
CREATE POLICY "Anyone can view completed recognition for published dishes"
ON public.dish_ai_recognitions
FOR SELECT
USING (
  status = 'completed'
  AND EXISTS (
    SELECT 1 FROM public.dishes d
    WHERE d.id = dish_ai_recognitions.dish_id
      AND d.is_published = true
  )
);

DROP POLICY IF EXISTS "Users can update their pending recognition cache rows" ON public.dish_ai_recognitions;
CREATE POLICY "Users can update their pending recognition cache rows"
ON public.dish_ai_recognitions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid());

ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS image_hash text,
ADD COLUMN IF NOT EXISTS ai_cuisine text,
ADD COLUMN IF NOT EXISTS ai_ingredients text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_photos_image_hash ON public.photos (image_hash) WHERE image_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_photos_dish_ai_status ON public.photos (dish_id, ai_status, updated_at DESC);