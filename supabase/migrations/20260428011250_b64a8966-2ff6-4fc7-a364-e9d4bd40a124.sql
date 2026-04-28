CREATE OR REPLACE FUNCTION public.slugify(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'))
$$;

CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_by UUID,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  slug TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL,
  description TEXT CHECK (description IS NULL OR char_length(description) <= 800),
  section TEXT CHECK (section IS NULL OR char_length(section) <= 120),
  cuisine TEXT CHECK (cuisine IS NULL OR char_length(cuisine) <= 80),
  tags TEXT[] NOT NULL DEFAULT '{}',
  dietary_tags TEXT[] NOT NULL DEFAULT '{}',
  typical_price NUMERIC(10,2) CHECK (typical_price IS NULL OR typical_price >= 0),
  price_min NUMERIC(10,2) CHECK (price_min IS NULL OR price_min >= 0),
  price_max NUMERIC(10,2) CHECK (price_max IS NULL OR price_max >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  aggregate_rating NUMERIC(2,1) NOT NULL DEFAULT 0 CHECK (aggregate_rating >= 0 AND aggregate_rating <= 5),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  photo_count INTEGER NOT NULL DEFAULT 0 CHECK (photo_count >= 0),
  cover_image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.menu_item_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 0 AND rating <= 5),
  review TEXT CHECK (review IS NULL OR char_length(review) <= 1600),
  price_paid NUMERIC(10,2) CHECK (price_paid IS NULL OR price_paid >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  image_url TEXT,
  image_path TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  would_order_again BOOLEAN,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.menu_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  image_url TEXT,
  image_path TEXT NOT NULL,
  ocr_text TEXT CHECK (ocr_text IS NULL OR char_length(ocr_text) <= 10000),
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'extracted', 'confirmed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.menu_extractions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_photo_id UUID REFERENCES public.menu_photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  extracted_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  confirmed_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_ocr_text TEXT CHECK (raw_ocr_text IS NULL OR char_length(raw_ocr_text) <= 10000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'discarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.favorite_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  slug TEXT NOT NULL UNIQUE,
  description TEXT CHECK (description IS NULL OR char_length(description) <= 600),
  cover_image_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.favorite_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.favorite_lists(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (list_id, menu_item_id)
);

CREATE INDEX idx_menu_items_normalized_name ON public.menu_items(normalized_name);
CREATE INDEX idx_menu_items_rating ON public.menu_items(aggregate_rating DESC, review_count DESC);
CREATE INDEX idx_menu_items_tags ON public.menu_items USING GIN(tags);
CREATE INDEX idx_menu_items_dietary_tags ON public.menu_items USING GIN(dietary_tags);
CREATE INDEX idx_menu_item_reviews_item_created ON public.menu_item_reviews(menu_item_id, created_at DESC);
CREATE INDEX idx_favorite_lists_slug ON public.favorite_lists(slug);

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_menu_item_reviews_updated_at BEFORE UPDATE ON public.menu_item_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_menu_photos_updated_at BEFORE UPDATE ON public.menu_photos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_menu_extractions_updated_at BEFORE UPDATE ON public.menu_extractions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_favorite_lists_updated_at BEFORE UPDATE ON public.favorite_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.refresh_menu_item_stats(_menu_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.menu_items mi
  SET aggregate_rating = COALESCE((SELECT round(avg(rating)::numeric, 1) FROM public.menu_item_reviews WHERE menu_item_id = _menu_item_id AND is_public = true), 0),
      review_count = COALESCE((SELECT count(*)::int FROM public.menu_item_reviews WHERE menu_item_id = _menu_item_id AND is_public = true), 0),
      price_min = (SELECT min(price_paid) FROM public.menu_item_reviews WHERE menu_item_id = _menu_item_id AND price_paid IS NOT NULL AND is_public = true),
      price_max = (SELECT max(price_paid) FROM public.menu_item_reviews WHERE menu_item_id = _menu_item_id AND price_paid IS NOT NULL AND is_public = true),
      photo_count = COALESCE((SELECT count(*)::int FROM public.menu_item_reviews WHERE menu_item_id = _menu_item_id AND image_url IS NOT NULL AND is_public = true), 0)
  WHERE mi.id = _menu_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.handle_menu_item_review_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM private.refresh_menu_item_stats(OLD.menu_item_id);
    RETURN OLD;
  END IF;
  PERFORM private.refresh_menu_item_stats(NEW.menu_item_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.refresh_menu_item_stats(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.handle_menu_item_review_stats() FROM PUBLIC;

CREATE TRIGGER refresh_menu_item_stats_after_review
AFTER INSERT OR UPDATE OR DELETE ON public.menu_item_reviews
FOR EACH ROW EXECUTE FUNCTION private.handle_menu_item_review_stats();

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view restaurants" ON public.restaurants;
CREATE POLICY "Anyone can view restaurants" ON public.restaurants FOR SELECT USING (true);

CREATE POLICY "Anyone can view published menu items" ON public.menu_items FOR SELECT USING (is_published = true);
CREATE POLICY "Users can create menu items" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (created_by IS NULL OR created_by = auth.uid());
CREATE POLICY "Creators can update menu items" ON public.menu_items FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "Anyone can view public menu item reviews" ON public.menu_item_reviews FOR SELECT USING (is_public = true);
CREATE POLICY "Users can create their own menu item reviews" ON public.menu_item_reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own menu item reviews" ON public.menu_item_reviews FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their own menu item reviews" ON public.menu_item_reviews FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can view their menu photos" ON public.menu_photos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create their menu photos" ON public.menu_photos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their menu photos" ON public.menu_photos FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their menu extractions" ON public.menu_extractions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create their menu extractions" ON public.menu_extractions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their menu extractions" ON public.menu_extractions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Anyone can view public favorite lists" ON public.favorite_lists FOR SELECT USING (is_public = true OR user_id = auth.uid());
CREATE POLICY "Users can create favorite lists" ON public.favorite_lists FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their favorite lists" ON public.favorite_lists FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their favorite lists" ON public.favorite_lists FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Anyone can view public favorite list items" ON public.favorite_list_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.favorite_lists fl WHERE fl.id = list_id AND (fl.is_public = true OR fl.user_id = auth.uid())));
CREATE POLICY "Users can add items to their lists" ON public.favorite_list_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.favorite_lists fl WHERE fl.id = list_id AND fl.user_id = auth.uid()));
CREATE POLICY "Users can update their list items" ON public.favorite_list_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.favorite_lists fl WHERE fl.id = list_id AND fl.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.favorite_lists fl WHERE fl.id = list_id AND fl.user_id = auth.uid()));
CREATE POLICY "Users can remove items from their lists" ON public.favorite_list_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.favorite_lists fl WHERE fl.id = list_id AND fl.user_id = auth.uid()));