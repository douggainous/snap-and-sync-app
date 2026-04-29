ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS ai_dish_name text,
ADD COLUMN IF NOT EXISTS ai_tags text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ai_confidence numeric,
ADD COLUMN IF NOT EXISTS ai_status text NOT NULL DEFAULT 'not_requested',
ADD COLUMN IF NOT EXISTS ai_error text;

CREATE INDEX IF NOT EXISTS photos_ai_status_idx ON public.photos (ai_status);
CREATE INDEX IF NOT EXISTS photos_ai_tags_idx ON public.photos USING gin(ai_tags);