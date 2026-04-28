ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS website_url text,
ADD COLUMN IF NOT EXISTS email text;

CREATE OR REPLACE FUNCTION public.validate_restaurant_contact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_restaurant_contact_trigger ON public.restaurants;
CREATE TRIGGER validate_restaurant_contact_trigger
BEFORE INSERT OR UPDATE ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.validate_restaurant_contact();