UPDATE storage.buckets
SET public = false
WHERE id = 'dish-photos';

DROP POLICY IF EXISTS "Dish photos are publicly viewable" ON storage.objects;
