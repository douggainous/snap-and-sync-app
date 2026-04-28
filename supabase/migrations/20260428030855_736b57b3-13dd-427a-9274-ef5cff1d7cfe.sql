DROP POLICY IF EXISTS "Authenticated users can view food post images" ON storage.objects;

CREATE POLICY "Users can view visible food post images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'food-post-images'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.food_posts fp
      WHERE fp.image_path = storage.objects.name
        AND (
          fp.user_id = auth.uid()
          OR private.can_view_food_post(fp.id, auth.uid())
        )
    )
  )
);