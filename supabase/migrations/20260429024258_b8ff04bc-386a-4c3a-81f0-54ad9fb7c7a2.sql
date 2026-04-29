-- Resolve security linter warnings introduced by production dish schema migration.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_current_user_profile()
RETURNS public.users
LANGUAGE plpgsql
SECURITY INVOKER
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

REVOKE EXECUTE ON FUNCTION public.refresh_dish_rollups(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_dish_rollups_from_child() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_menu_item_review_rollup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_menu_item_rating(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_profile() TO authenticated;
