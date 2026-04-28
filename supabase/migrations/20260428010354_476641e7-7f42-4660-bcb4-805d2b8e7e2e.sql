CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.can_view_food_post(_post_id UUID, _viewer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.food_posts fp
    WHERE fp.id = _post_id
      AND fp.is_draft = false
      AND (
        fp.user_id = _viewer_id
        OR fp.visibility = 'public'
        OR (
          fp.visibility = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.follows f
            WHERE f.follower_id = _viewer_id
              AND f.following_id = fp.user_id
          )
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION private.can_view_food_post(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_food_post(UUID, UUID) FROM PUBLIC;

DROP POLICY IF EXISTS "Users can view allowed food posts" ON public.food_posts;
DROP POLICY IF EXISTS "Users can view likes on visible posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can like visible posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can save visible posts" ON public.post_saves;
DROP POLICY IF EXISTS "Users can view comments on visible posts" ON public.post_comments;
DROP POLICY IF EXISTS "Users can comment on visible posts" ON public.post_comments;

CREATE POLICY "Users can view allowed food posts"
ON public.food_posts FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.can_view_food_post(id, auth.uid()));

CREATE POLICY "Users can view likes on visible posts"
ON public.post_likes FOR SELECT TO authenticated
USING (private.can_view_food_post(post_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Users can like visible posts"
ON public.post_likes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND private.can_view_food_post(post_id, auth.uid()));

CREATE POLICY "Users can save visible posts"
ON public.post_saves FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND private.can_view_food_post(post_id, auth.uid()));

CREATE POLICY "Users can view comments on visible posts"
ON public.post_comments FOR SELECT TO authenticated
USING (private.can_view_food_post(post_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Users can comment on visible posts"
ON public.post_comments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND private.can_view_food_post(post_id, auth.uid()));

DROP FUNCTION public.can_view_food_post(UUID, UUID);

UPDATE storage.buckets
SET public = false
WHERE id = 'avatars';

DROP POLICY IF EXISTS "Avatar images are publicly viewable" ON storage.objects;

CREATE POLICY "Signed-in users can view avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');