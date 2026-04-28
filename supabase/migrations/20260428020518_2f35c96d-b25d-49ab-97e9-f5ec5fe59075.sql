ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS google_place_id TEXT,
ADD COLUMN IF NOT EXISTS rating NUMERIC,
ADD COLUMN IF NOT EXISTS review_count INTEGER,
ADD COLUMN IF NOT EXISTS price_level INTEGER,
ADD COLUMN IF NOT EXISTS business_status TEXT,
ADD COLUMN IF NOT EXISTS maps_url TEXT,
ADD COLUMN IF NOT EXISTS photo_reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_google_place_id_key
ON public.restaurants (google_place_id)
WHERE google_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_location
ON public.restaurants (latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_restaurant_contact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.phone IS NOT NULL AND length(NEW.phone) > 40 THEN
    RAISE EXCEPTION 'Phone must be 40 characters or fewer';
  END IF;

  IF NEW.website_url IS NOT NULL AND (length(NEW.website_url) > 300 OR NEW.website_url !~* '^https?://') THEN
    RAISE EXCEPTION 'Website URL must start with http:// or https:// and be 300 characters or fewer';
  END IF;

  IF NEW.email IS NOT NULL AND (length(NEW.email) > 254 OR NEW.email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$') THEN
    RAISE EXCEPTION 'Email address is invalid';
  END IF;

  IF NEW.google_place_id IS NOT NULL AND length(NEW.google_place_id) > 255 THEN
    RAISE EXCEPTION 'Google place id must be 255 characters or fewer';
  END IF;

  IF NEW.rating IS NOT NULL AND (NEW.rating < 0 OR NEW.rating > 5) THEN
    RAISE EXCEPTION 'Restaurant rating must be between 0 and 5';
  END IF;

  IF NEW.review_count IS NOT NULL AND NEW.review_count < 0 THEN
    RAISE EXCEPTION 'Review count cannot be negative';
  END IF;

  IF NEW.price_level IS NOT NULL AND (NEW.price_level < 0 OR NEW.price_level > 4) THEN
    RAISE EXCEPTION 'Price level must be between 0 and 4';
  END IF;

  IF NEW.maps_url IS NOT NULL AND (length(NEW.maps_url) > 500 OR NEW.maps_url !~* '^https?://') THEN
    RAISE EXCEPTION 'Maps URL must start with http:// or https:// and be 500 characters or fewer';
  END IF;

  IF NEW.photo_reference IS NOT NULL AND length(NEW.photo_reference) > 1000 THEN
    RAISE EXCEPTION 'Photo reference must be 1000 characters or fewer';
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;