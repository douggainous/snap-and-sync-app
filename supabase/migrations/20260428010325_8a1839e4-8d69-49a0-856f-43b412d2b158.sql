CREATE TYPE public.post_visibility AS ENUM ('public', 'followers', 'private');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 3 AND 32 AND username ~ '^[a-zA-Z0-9_]+$'),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  avatar_url TEXT,
  bio TEXT CHECK (bio IS NULL OR char_length(bio) <= 280),
  dietary_preferences TEXT[] NOT NULL DEFAULT '{}',
  favorite_cuisines TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  address TEXT CHECK (address IS NULL OR char_length(address) <= 240),
  city TEXT CHECK (city IS NULL OR char_length(city) <= 120),
  cuisine TEXT CHECK (cuisine IS NULL OR char_length(cuisine) <= 80),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.food_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  restaurant_name TEXT NOT NULL CHECK (char_length(restaurant_name) BETWEEN 1 AND 160),
  dish_name TEXT NOT NULL CHECK (char_length(dish_name) BETWEEN 1 AND 140),
  review TEXT CHECK (review IS NULL OR char_length(review) <= 1600),
  rating NUMERIC(2,1) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  price NUMERIC(10,2) CHECK (price IS NULL OR price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  cuisine TEXT CHECK (cuisine IS NULL OR char_length(cuisine) <= 80),
  image_url TEXT,
  image_path TEXT,
  visibility public.post_visibility NOT NULL DEFAULT 'followers',
  is_draft BOOLEAN NOT NULL DEFAULT false,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  ai_tags TEXT[] NOT NULL DEFAULT '{}',
  dietary_tags TEXT[] NOT NULL DEFAULT '{}',
  ocr_text TEXT CHECK (ocr_text IS NULL OR char_length(ocr_text) <= 6000),
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE TABLE public.post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.food_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE public.post_saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.food_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.food_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_restaurants_name ON public.restaurants(name);
CREATE INDEX idx_food_posts_user_created ON public.food_posts(user_id, created_at DESC);
CREATE INDEX idx_food_posts_visibility_created ON public.food_posts(visibility, created_at DESC);
CREATE INDEX idx_food_posts_ai_tags ON public.food_posts USING GIN(ai_tags);
CREATE INDEX idx_food_posts_dietary_tags ON public.food_posts USING GIN(dietary_tags);
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);
CREATE INDEX idx_post_comments_post_created ON public.post_comments(post_id, created_at DESC);

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurants_updated_at
BEFORE UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_food_posts_updated_at
BEFORE UPDATE ON public.food_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_post_comments_updated_at
BEFORE UPDATE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_view_food_post(_post_id UUID, _viewer_id UUID)
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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view restaurants"
ON public.restaurants FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can create restaurants"
ON public.restaurants FOR INSERT TO authenticated
WITH CHECK (created_by IS NULL OR created_by = auth.uid());

CREATE POLICY "Creators can update restaurants"
ON public.restaurants FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can view allowed food posts"
ON public.food_posts FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_view_food_post(id, auth.uid()));

CREATE POLICY "Users can create their own food posts"
ON public.food_posts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own food posts"
ON public.food_posts FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own food posts"
ON public.food_posts FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can view their follow relationships"
ON public.follows FOR SELECT TO authenticated
USING (follower_id = auth.uid() OR following_id = auth.uid());

CREATE POLICY "Users can follow others"
ON public.follows FOR INSERT TO authenticated
WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can unfollow others"
ON public.follows FOR DELETE TO authenticated
USING (follower_id = auth.uid());

CREATE POLICY "Users can view likes on visible posts"
ON public.post_likes FOR SELECT TO authenticated
USING (public.can_view_food_post(post_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Users can like visible posts"
ON public.post_likes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.can_view_food_post(post_id, auth.uid()));

CREATE POLICY "Users can remove their likes"
ON public.post_likes FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can view their saved posts"
ON public.post_saves FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can save visible posts"
ON public.post_saves FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.can_view_food_post(post_id, auth.uid()));

CREATE POLICY "Users can remove their saves"
ON public.post_saves FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can view comments on visible posts"
ON public.post_comments FOR SELECT TO authenticated
USING (public.can_view_food_post(post_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Users can comment on visible posts"
ON public.post_comments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.can_view_food_post(post_id, auth.uid()));

CREATE POLICY "Users can update their comments"
ON public.post_comments FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their comments"
ON public.post_comments FOR DELETE TO authenticated
USING (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('food-post-images', 'food-post-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their avatar files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their avatar files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their avatar files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can view food post images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'food-post-images');

CREATE POLICY "Users can upload their food post images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'food-post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their food post images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'food-post-images' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'food-post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their food post images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'food-post-images' AND auth.uid()::text = (storage.foldername(name))[1]);