ALTER TABLE public.tags
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS confidence numeric NOT NULL DEFAULT 0.7;

ALTER TABLE public.dish_tags
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS confidence numeric NOT NULL DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS idx_tags_category_slug ON public.tags(category, slug);
CREATE INDEX IF NOT EXISTS idx_dish_tags_category_confidence ON public.dish_tags(dish_id, category, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_dish_tags_tag_confidence ON public.dish_tags(tag_id, confidence DESC);