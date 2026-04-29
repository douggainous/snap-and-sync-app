REVOKE ALL ON FUNCTION public.user_has_approved_restaurant_claim(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_approved_restaurant_claim(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.user_has_approved_restaurant_claim(uuid, uuid) FROM authenticated;