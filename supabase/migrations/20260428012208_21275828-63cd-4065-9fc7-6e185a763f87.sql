-- Validate item review content and keep menu item ratings in sync
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

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_menu_item_rating(_menu_item_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.menu_items
  SET
    aggregate_rating = COALESCE((
      SELECT round(avg(rating)::numeric, 1)
      FROM public.menu_item_reviews
      WHERE menu_item_id = _menu_item_id
        AND is_public = true
    ), 0),
    review_count = (
      SELECT count(*)::integer
      FROM public.menu_item_reviews
      WHERE menu_item_id = _menu_item_id
        AND is_public = true
    ),
    updated_at = now()
  WHERE id = _menu_item_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_menu_item_review_rollup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_menu_item_rating(OLD.menu_item_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_menu_item_rating(NEW.menu_item_id);

  IF TG_OP = 'UPDATE' AND OLD.menu_item_id IS DISTINCT FROM NEW.menu_item_id THEN
    PERFORM public.refresh_menu_item_rating(OLD.menu_item_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_menu_item_review_trigger ON public.menu_item_reviews;
CREATE TRIGGER validate_menu_item_review_trigger
BEFORE INSERT OR UPDATE ON public.menu_item_reviews
FOR EACH ROW
EXECUTE FUNCTION public.validate_menu_item_review();

DROP TRIGGER IF EXISTS sync_menu_item_review_rollup_trigger ON public.menu_item_reviews;
CREATE TRIGGER sync_menu_item_review_rollup_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.menu_item_reviews
FOR EACH ROW
EXECUTE FUNCTION public.sync_menu_item_review_rollup();