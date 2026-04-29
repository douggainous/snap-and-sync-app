CREATE TABLE IF NOT EXISTS public.review_caption_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  rating_id UUID REFERENCES public.ratings(id) ON DELETE SET NULL,
  input_hash TEXT NOT NULL,
  caption TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  model TEXT,
  generated_from JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT review_caption_suggestions_status_check CHECK (status IN ('pending', 'completed', 'failed', 'rate_limited', 'payment_required')),
  CONSTRAINT review_caption_suggestions_caption_length CHECK (caption IS NULL OR char_length(caption) <= 180),
  CONSTRAINT review_caption_suggestions_input_hash_length CHECK (char_length(input_hash) BETWEEN 16 AND 128),
  UNIQUE (user_id, dish_id, input_hash)
);

ALTER TABLE public.review_caption_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own caption suggestions"
ON public.review_caption_suggestions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own caption suggestions"
ON public.review_caption_suggestions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own caption suggestions"
ON public.review_caption_suggestions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own caption suggestions"
ON public.review_caption_suggestions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_review_caption_suggestions_user_dish
ON public.review_caption_suggestions (user_id, dish_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_caption_suggestions_rating
ON public.review_caption_suggestions (rating_id)
WHERE rating_id IS NOT NULL;

CREATE TRIGGER update_review_caption_suggestions_updated_at
BEFORE UPDATE ON public.review_caption_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();