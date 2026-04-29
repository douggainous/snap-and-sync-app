CREATE TABLE IF NOT EXISTS public.collections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  cover_image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT collections_name_length CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT collections_slug_length CHECK (char_length(slug) BETWEEN 1 AND 120),
  CONSTRAINT collections_user_slug_unique UNIQUE (user_id, slug)
);

CREATE TABLE IF NOT EXISTS public.collection_dishes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  dish_id uuid NOT NULL,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT collection_dishes_unique UNIQUE (collection_id, dish_id)
);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_dishes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_collections_user_updated ON public.collections (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_public_updated ON public.collections (is_public, updated_at DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_collection_dishes_collection_created ON public.collection_dishes (collection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_dishes_dish_id ON public.collection_dishes (dish_id);

CREATE OR REPLACE FUNCTION public.set_collection_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.slug := COALESCE(NULLIF(NEW.slug, ''), public.slugify(NEW.name));
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_collection_fields_trigger ON public.collections;
CREATE TRIGGER set_collection_fields_trigger
BEFORE INSERT OR UPDATE ON public.collections
FOR EACH ROW
EXECUTE FUNCTION public.set_collection_fields();

DROP POLICY IF EXISTS "Users can view their own and public collections" ON public.collections;
CREATE POLICY "Users can view their own and public collections"
ON public.collections
FOR SELECT
USING (is_public = true OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own collections" ON public.collections;
CREATE POLICY "Users can create their own collections"
ON public.collections
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own collections" ON public.collections;
CREATE POLICY "Users can update their own collections"
ON public.collections
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own collections" ON public.collections;
CREATE POLICY "Users can delete their own collections"
ON public.collections
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view accessible collection dishes" ON public.collection_dishes;
CREATE POLICY "Users can view accessible collection dishes"
ON public.collection_dishes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.collections c
  WHERE c.id = collection_dishes.collection_id
    AND (c.is_public = true OR c.user_id = auth.uid())
));

DROP POLICY IF EXISTS "Users can add dishes to their collections" ON public.collection_dishes;
CREATE POLICY "Users can add dishes to their collections"
ON public.collection_dishes
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.collections c
  WHERE c.id = collection_dishes.collection_id
    AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can update dishes in their collections" ON public.collection_dishes;
CREATE POLICY "Users can update dishes in their collections"
ON public.collection_dishes
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.collections c
  WHERE c.id = collection_dishes.collection_id
    AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.collections c
  WHERE c.id = collection_dishes.collection_id
    AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can remove dishes from their collections" ON public.collection_dishes;
CREATE POLICY "Users can remove dishes from their collections"
ON public.collection_dishes
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.collections c
  WHERE c.id = collection_dishes.collection_id
    AND c.user_id = auth.uid()
));