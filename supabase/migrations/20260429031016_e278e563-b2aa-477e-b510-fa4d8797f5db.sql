CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.set_dish_search_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.normalized_name = lower(regexp_replace(trim(NEW.name), '\s+', ' ', 'g'));
  NEW.slug = COALESCE(NULLIF(NEW.slug, ''), public.slugify(NEW.name));
  NEW.search_vector =
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.cuisine, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.section, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_restaurant_search_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.normalized_name = lower(regexp_replace(trim(NEW.name), '\s+', ' ', 'g'));
  NEW.slug = COALESCE(NULLIF(NEW.slug, ''), public.slugify(NEW.name));
  NEW.search_vector =
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.cuisine, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.city, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.address, '')), 'C');
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_dish_search_fields_trigger ON public.dishes;
CREATE TRIGGER set_dish_search_fields_trigger
BEFORE INSERT OR UPDATE OF name, cuisine, section, description, slug
ON public.dishes
FOR EACH ROW
EXECUTE FUNCTION public.set_dish_search_fields();

DROP TRIGGER IF EXISTS set_restaurant_search_fields_trigger ON public.restaurants;
CREATE TRIGGER set_restaurant_search_fields_trigger
BEFORE INSERT OR UPDATE OF name, cuisine, city, address, slug
ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.set_restaurant_search_fields();

UPDATE public.dishes
SET name = name
WHERE search_vector IS NULL OR normalized_name IS NULL;

UPDATE public.restaurants
SET name = name
WHERE search_vector IS NULL OR normalized_name IS NULL;

CREATE INDEX IF NOT EXISTS dishes_search_vector_idx ON public.dishes USING gin(search_vector);
CREATE INDEX IF NOT EXISTS dishes_name_trgm_idx ON public.dishes USING gin(normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS dishes_cuisine_idx ON public.dishes (lower(cuisine)) WHERE cuisine IS NOT NULL;
CREATE INDEX IF NOT EXISTS dishes_rating_idx ON public.dishes (aggregate_rating DESC, rating_count DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS dishes_trending_idx ON public.dishes (trending_score DESC, created_at DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS dishes_recent_idx ON public.dishes (created_at DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS restaurants_search_vector_idx ON public.restaurants USING gin(search_vector);
CREATE INDEX IF NOT EXISTS restaurants_name_trgm_idx ON public.restaurants USING gin(normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS restaurants_location_idx ON public.restaurants (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS restaurants_cuisine_idx ON public.restaurants (lower(cuisine)) WHERE cuisine IS NOT NULL;