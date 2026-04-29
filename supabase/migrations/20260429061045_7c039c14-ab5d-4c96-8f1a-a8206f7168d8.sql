CREATE INDEX IF NOT EXISTS idx_dishes_published_slug
ON public.dishes (slug)
WHERE is_published = true;