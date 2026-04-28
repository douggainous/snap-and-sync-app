ALTER TABLE public.menu_item_reviews
ADD COLUMN IF NOT EXISTS temperature_rating integer,
ADD COLUMN IF NOT EXISTS spiciness_rating integer,
ADD COLUMN IF NOT EXISTS sweet_savory_rating integer,
ADD COLUMN IF NOT EXISTS flavor_intensity_rating integer;

CREATE OR REPLACE FUNCTION public.validate_menu_item_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  IF NEW.review IS NOT NULL AND length(NEW.review) > 1200 THEN
    RAISE EXCEPTION 'Review must be 1200 characters or fewer';
  END IF;

  IF NEW.price_paid IS NOT NULL AND (NEW.price_paid < 0 OR NEW.price_paid > 10000) THEN
    RAISE EXCEPTION 'Price paid is outside the allowed range';
  END IF;

  IF NEW.temperature_rating IS NOT NULL AND (NEW.temperature_rating < 1 OR NEW.temperature_rating > 5) THEN
    RAISE EXCEPTION 'Temperature rating must be between 1 and 5';
  END IF;

  IF NEW.spiciness_rating IS NOT NULL AND (NEW.spiciness_rating < 0 OR NEW.spiciness_rating > 5) THEN
    RAISE EXCEPTION 'Spiciness rating must be between 0 and 5';
  END IF;

  IF NEW.sweet_savory_rating IS NOT NULL AND (NEW.sweet_savory_rating < 1 OR NEW.sweet_savory_rating > 5) THEN
    RAISE EXCEPTION 'Sweet savory rating must be between 1 and 5';
  END IF;

  IF NEW.flavor_intensity_rating IS NOT NULL AND (NEW.flavor_intensity_rating < 1 OR NEW.flavor_intensity_rating > 5) THEN
    RAISE EXCEPTION 'Flavor intensity rating must be between 1 and 5';
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;