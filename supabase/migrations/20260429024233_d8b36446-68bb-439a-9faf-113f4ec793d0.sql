-- Production dish-centric schema for PlateLoop
-- This migration extends the existing app database without removing existing tables.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'saved_item_type') THEN
    CREATE TYPE public.saved_item_type AS ENUM ('saved', 'want_to_try', 'tried', 'liked');
  END IF;
END $$;

-- Users: app-level user profile keyed to the authenticated user's UUID.
-- The app should store auth.uid() as public.users.id.
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  email TEXT,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  favorite_cuisines TEXT[] NOT NULL DEFAULT '{}',
  dietary_preferences TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_username_unique_idx ON public.users (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX users_display_name_search_idx ON public.users USING gin (display_name gin_trgm_ops) WHERE display_name IS NOT NULL;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own account profile"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can create their own account profile"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own account profile"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.ensure_current_user_profile()
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.users;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    auth.uid(),
    auth.jwt() ->> 'email',
    COALESCE(auth.jwt() #>> '{user_metadata,full_name}', auth.jwt() #>> '{user_metadata,name}'),
    COALESCE(auth.jwt() #>> '{user_metadata,avatar_url}', auth.jwt() #>> '{user_metadata,picture}')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.users.email),
    display_name = COALESCE(public.users.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.users.avatar_url, EXCLUDED.avatar_url),
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enhance existing restaurants table for production discovery.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS normalized_name TEXT,
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(name, '') || ' ' ||
      coalesce(city, '') || ' ' ||
      coalesce(cuisine, '') || ' ' ||
      coalesce(address, '')
    )
  ) STORED;

UPDATE public.restaurants
SET
  normalized_name = lower(regexp_replace(coalesce(name, ''), '[^a-zA-Z0-9]+', ' ', 'g')),
  slug = COALESCE(slug, public.slugify(name) || '-' || left(id::text, 8))
WHERE slug IS NULL OR normalized_name IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_slug_unique_idx ON public.restaurants (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS restaurants_location_idx ON public.restaurants (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS restaurants_search_vector_idx ON public.restaurants USING gin (search_vector);
CREATE INDEX IF NOT EXISTS restaurants_name_trgm_idx ON public.restaurants USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS restaurants_google_place_id_idx ON public.restaurants (google_place_id) WHERE google_place_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_created_by_users_fk'
  ) THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_created_by_users_fk
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- Dishes: primary production entity for discovery.
CREATE TABLE public.dishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  description TEXT,
  cuisine TEXT,
  section TEXT,
  typical_price NUMERIC(10,2),
  price_min NUMERIC(10,2),
  price_max NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  cover_photo_id UUID,
  aggregate_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  photo_count INTEGER NOT NULL DEFAULT 0,
  save_count INTEGER NOT NULL DEFAULT 0,
  want_to_try_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  trending_score NUMERIC(12,4) NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(name, '') || ' ' ||
      coalesce(normalized_name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(cuisine, '') || ' ' ||
      coalesce(section, '')
    )
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dishes_rating_bounds CHECK (aggregate_rating >= 0 AND aggregate_rating <= 5),
  CONSTRAINT dishes_price_bounds CHECK (
    (typical_price IS NULL OR typical_price >= 0) AND
    (price_min IS NULL OR price_min >= 0) AND
    (price_max IS NULL OR price_max >= 0) AND
    (price_min IS NULL OR price_max IS NULL OR price_min <= price_max)
  )
);

CREATE UNIQUE INDEX dishes_restaurant_slug_unique_idx ON public.dishes (restaurant_id, slug);
CREATE INDEX dishes_restaurant_idx ON public.dishes (restaurant_id);
CREATE INDEX dishes_created_by_idx ON public.dishes (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX dishes_search_vector_idx ON public.dishes USING gin (search_vector);
CREATE INDEX dishes_name_trgm_idx ON public.dishes USING gin (name gin_trgm_ops);
CREATE INDEX dishes_normalized_name_idx ON public.dishes (normalized_name);
CREATE INDEX dishes_trending_idx ON public.dishes (is_published, trending_score DESC, aggregate_rating DESC, review_count DESC, photo_count DESC, updated_at DESC);
CREATE INDEX dishes_published_recent_idx ON public.dishes (is_published, updated_at DESC);

ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published dishes"
ON public.dishes
FOR SELECT
TO public
USING (is_published = true);

CREATE POLICY "Creators can view their unpublished dishes"
ON public.dishes
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Users can create dishes"
ON public.dishes
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can update their dishes"
ON public.dishes
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can delete their dishes"
ON public.dishes
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

CREATE TRIGGER update_dishes_updated_at
BEFORE UPDATE ON public.dishes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Photos: persistent image records backed by private storage paths or trusted remote URLs.
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  review_id UUID,
  storage_bucket TEXT NOT NULL DEFAULT 'food-post-images',
  storage_path TEXT,
  image_url TEXT,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT photos_source_required CHECK (storage_path IS NOT NULL OR image_url IS NOT NULL),
  CONSTRAINT photos_dimensions_positive CHECK ((width IS NULL OR width > 0) AND (height IS NULL OR height > 0))
);

CREATE INDEX photos_dish_idx ON public.photos (dish_id, created_at DESC);
CREATE INDEX photos_user_idx ON public.photos (user_id, created_at DESC);
CREATE INDEX photos_public_recent_idx ON public.photos (is_public, created_at DESC);
CREATE UNIQUE INDEX photos_storage_unique_idx ON public.photos (storage_bucket, storage_path) WHERE storage_path IS NOT NULL;

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public photos for published dishes"
ON public.photos
FOR SELECT
TO public
USING (
  is_public = true AND EXISTS (
    SELECT 1 FROM public.dishes d
    WHERE d.id = photos.dish_id AND d.is_published = true
  )
);

CREATE POLICY "Users can view their own photos"
ON public.photos
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own photos"
ON public.photos
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own photos"
ON public.photos
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own photos"
ON public.photos
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_photos_updated_at
BEFORE UPDATE ON public.photos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.dishes
  ADD CONSTRAINT dishes_cover_photo_fk
  FOREIGN KEY (cover_photo_id) REFERENCES public.photos(id) ON DELETE SET NULL;

-- Ratings: canonical numeric dish rating records.
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating NUMERIC(2,1) NOT NULL,
  would_order_again BOOLEAN,
  temperature_rating INTEGER,
  spiciness_rating INTEGER,
  sweet_savory_rating INTEGER,
  flavor_intensity_rating INTEGER,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ratings_value_bounds CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT ratings_temperature_bounds CHECK (temperature_rating IS NULL OR (temperature_rating >= 1 AND temperature_rating <= 5)),
  CONSTRAINT ratings_spiciness_bounds CHECK (spiciness_rating IS NULL OR (spiciness_rating >= 0 AND spiciness_rating <= 5)),
  CONSTRAINT ratings_sweet_savory_bounds CHECK (sweet_savory_rating IS NULL OR (sweet_savory_rating >= 1 AND sweet_savory_rating <= 5)),
  CONSTRAINT ratings_flavor_bounds CHECK (flavor_intensity_rating IS NULL OR (flavor_intensity_rating >= 1 AND flavor_intensity_rating <= 5))
);

CREATE UNIQUE INDEX ratings_user_dish_unique_idx ON public.ratings (user_id, dish_id);
CREATE INDEX ratings_dish_public_idx ON public.ratings (dish_id, is_public, created_at DESC);
CREATE INDEX ratings_user_recent_idx ON public.ratings (user_id, created_at DESC);
CREATE INDEX ratings_trending_recent_idx ON public.ratings (is_public, created_at DESC, rating DESC);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public ratings for published dishes"
ON public.ratings
FOR SELECT
TO public
USING (
  is_public = true AND EXISTS (
    SELECT 1 FROM public.dishes d
    WHERE d.id = ratings.dish_id AND d.is_published = true
  )
);

CREATE POLICY "Users can view their own ratings"
ON public.ratings
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own ratings"
ON public.ratings
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own ratings"
ON public.ratings
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own ratings"
ON public.ratings
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_ratings_updated_at
BEFORE UPDATE ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Reviews: text review content, optionally tied one-to-one to a rating.
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating_id UUID REFERENCES public.ratings(id) ON DELETE SET NULL,
  body TEXT,
  price_paid NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reviews_body_length CHECK (body IS NULL OR length(body) <= 1200),
  CONSTRAINT reviews_price_bounds CHECK (price_paid IS NULL OR price_paid >= 0)
);

CREATE UNIQUE INDEX reviews_rating_unique_idx ON public.reviews (rating_id) WHERE rating_id IS NOT NULL;
CREATE INDEX reviews_dish_public_recent_idx ON public.reviews (dish_id, is_public, created_at DESC);
CREATE INDEX reviews_user_recent_idx ON public.reviews (user_id, created_at DESC);
CREATE INDEX reviews_body_search_idx ON public.reviews USING gin (body gin_trgm_ops) WHERE body IS NOT NULL;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public reviews for published dishes"
ON public.reviews
FOR SELECT
TO public
USING (
  is_public = true AND EXISTS (
    SELECT 1 FROM public.dishes d
    WHERE d.id = reviews.dish_id AND d.is_published = true
  )
);

CREATE POLICY "Users can view their own reviews"
ON public.reviews
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own reviews"
ON public.reviews
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.photos
  ADD CONSTRAINT photos_review_fk
  FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE SET NULL;

-- Saved items: fast consumer actions for dishes.
CREATE TABLE public.saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  action_type public.saved_item_type NOT NULL DEFAULT 'saved',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT saved_items_note_length CHECK (note IS NULL OR length(note) <= 500)
);

CREATE UNIQUE INDEX saved_items_user_dish_action_unique_idx ON public.saved_items (user_id, dish_id, action_type);
CREATE INDEX saved_items_user_action_recent_idx ON public.saved_items (user_id, action_type, created_at DESC);
CREATE INDEX saved_items_dish_action_idx ON public.saved_items (dish_id, action_type);
CREATE INDEX saved_items_trending_idx ON public.saved_items (action_type, created_at DESC);

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved dish actions"
ON public.saved_items
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own saved dish actions"
ON public.saved_items
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own saved dish actions"
ON public.saved_items
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own saved dish actions"
ON public.saved_items
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_saved_items_updated_at
BEFORE UPDATE ON public.saved_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tags and dish tag join table.
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tags_name_length CHECK (length(name) BETWEEN 1 AND 60)
);

CREATE UNIQUE INDEX tags_slug_unique_idx ON public.tags (slug);
CREATE INDEX tags_name_trgm_idx ON public.tags USING gin (name gin_trgm_ops);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tags"
ON public.tags
FOR SELECT
TO public
USING (true);

CREATE POLICY "Signed in users can create tags"
ON public.tags
FOR INSERT
TO authenticated
WITH CHECK (slug = public.slugify(name));

CREATE TABLE public.dish_tags (
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dish_id, tag_id)
);

CREATE INDEX dish_tags_tag_idx ON public.dish_tags (tag_id);
CREATE INDEX dish_tags_created_by_idx ON public.dish_tags (created_by) WHERE created_by IS NOT NULL;

ALTER TABLE public.dish_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tags for published dishes"
ON public.dish_tags
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.dishes d
    WHERE d.id = dish_tags.dish_id AND d.is_published = true
  )
);

CREATE POLICY "Dish creators can tag their dishes"
ON public.dish_tags
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.dishes d
    WHERE d.id = dish_tags.dish_id AND d.created_by = auth.uid()
  )
);

CREATE POLICY "Dish creators can remove tags from their dishes"
ON public.dish_tags
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.dishes d
    WHERE d.id = dish_tags.dish_id AND d.created_by = auth.uid()
  )
);

-- Rollup functions keep dish feed stats production-ready.
CREATE OR REPLACE FUNCTION public.refresh_dish_rollups(_dish_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.dishes
  SET
    aggregate_rating = COALESCE((
      SELECT round(avg(r.rating)::numeric, 2)
      FROM public.ratings r
      WHERE r.dish_id = _dish_id AND r.is_public = true
    ), 0),
    rating_count = (
      SELECT count(*)::integer
      FROM public.ratings r
      WHERE r.dish_id = _dish_id AND r.is_public = true
    ),
    review_count = (
      SELECT count(*)::integer
      FROM public.reviews rv
      WHERE rv.dish_id = _dish_id AND rv.is_public = true
    ),
    photo_count = (
      SELECT count(*)::integer
      FROM public.photos p
      WHERE p.dish_id = _dish_id AND p.is_public = true
    ),
    save_count = (
      SELECT count(*)::integer
      FROM public.saved_items s
      WHERE s.dish_id = _dish_id AND s.action_type = 'saved'
    ),
    want_to_try_count = (
      SELECT count(*)::integer
      FROM public.saved_items s
      WHERE s.dish_id = _dish_id AND s.action_type = 'want_to_try'
    ),
    like_count = (
      SELECT count(*)::integer
      FROM public.saved_items s
      WHERE s.dish_id = _dish_id AND s.action_type = 'liked'
    ),
    trending_score = (
      COALESCE((SELECT avg(r.rating)::numeric FROM public.ratings r WHERE r.dish_id = _dish_id AND r.is_public = true), 0) * 20
      + COALESCE((SELECT count(*)::numeric FROM public.reviews rv WHERE rv.dish_id = _dish_id AND rv.is_public = true), 0) * 4
      + COALESCE((SELECT count(*)::numeric FROM public.photos p WHERE p.dish_id = _dish_id AND p.is_public = true), 0) * 3
      + COALESCE((SELECT count(*)::numeric FROM public.saved_items s WHERE s.dish_id = _dish_id AND s.action_type IN ('saved', 'want_to_try')), 0) * 2
      + COALESCE((SELECT count(*)::numeric FROM public.saved_items s WHERE s.dish_id = _dish_id AND s.action_type = 'liked'), 0)
    ),
    updated_at = now()
  WHERE id = _dish_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_dish_rollups_from_child()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_dish_rollups(OLD.dish_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_dish_rollups(NEW.dish_id);

  IF TG_OP = 'UPDATE' AND OLD.dish_id IS DISTINCT FROM NEW.dish_id THEN
    PERFORM public.refresh_dish_rollups(OLD.dish_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_dish_rollups_from_ratings
AFTER INSERT OR UPDATE OR DELETE ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.sync_dish_rollups_from_child();

CREATE TRIGGER sync_dish_rollups_from_reviews
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.sync_dish_rollups_from_child();

CREATE TRIGGER sync_dish_rollups_from_photos
AFTER INSERT OR UPDATE OR DELETE ON public.photos
FOR EACH ROW
EXECUTE FUNCTION public.sync_dish_rollups_from_child();

CREATE TRIGGER sync_dish_rollups_from_saved_items
AFTER INSERT OR UPDATE OR DELETE ON public.saved_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_dish_rollups_from_child();
