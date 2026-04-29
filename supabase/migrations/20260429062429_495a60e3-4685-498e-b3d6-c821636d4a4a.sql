CREATE TABLE IF NOT EXISTS public.restaurant_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid,
  restaurant_name text NOT NULL,
  contact_name text,
  contact_email text,
  website_url text,
  status text NOT NULL DEFAULT 'pending',
  verification_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_claims_status_allowed CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT restaurant_claims_name_length CHECK (char_length(restaurant_name) BETWEEN 2 AND 160),
  CONSTRAINT restaurant_claims_contact_email_length CHECK (contact_email IS NULL OR char_length(contact_email) <= 254),
  CONSTRAINT restaurant_claims_website_url_length CHECK (website_url IS NULL OR char_length(website_url) <= 300)
);

ALTER TABLE public.restaurant_claims ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_restaurant_claims_user_status ON public.restaurant_claims (user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_claims_restaurant_status ON public.restaurant_claims (restaurant_id, status) WHERE restaurant_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_restaurant_claims_updated_at ON public.restaurant_claims;
CREATE TRIGGER update_restaurant_claims_updated_at
BEFORE UPDATE ON public.restaurant_claims
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can create their restaurant claims" ON public.restaurant_claims;
CREATE POLICY "Users can create their restaurant claims"
ON public.restaurant_claims
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Users can view their restaurant claims" ON public.restaurant_claims;
CREATE POLICY "Users can view their restaurant claims"
ON public.restaurant_claims
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update pending restaurant claims" ON public.restaurant_claims;
CREATE POLICY "Users can update pending restaurant claims"
ON public.restaurant_claims
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE OR REPLACE FUNCTION public.user_has_approved_restaurant_claim(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_claims rc
    WHERE rc.user_id = _user_id
      AND rc.restaurant_id = _restaurant_id
      AND rc.status = 'approved'
  )
$$;

CREATE TABLE IF NOT EXISTS public.restaurant_dish_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid,
  claim_id uuid,
  dish_id uuid,
  dish_name text NOT NULL,
  description text,
  cuisine text,
  typical_price numeric,
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_dish_submissions_status_allowed CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT restaurant_dish_submissions_name_length CHECK (char_length(dish_name) BETWEEN 2 AND 160),
  CONSTRAINT restaurant_dish_submissions_price_range CHECK (typical_price IS NULL OR (typical_price >= 0 AND typical_price <= 10000))
);

ALTER TABLE public.restaurant_dish_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_restaurant_dish_submissions_user_status ON public.restaurant_dish_submissions (user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_dish_submissions_restaurant_status ON public.restaurant_dish_submissions (restaurant_id, status) WHERE restaurant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_dish_submissions_dish_status ON public.restaurant_dish_submissions (dish_id, status) WHERE dish_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_restaurant_dish_submissions_updated_at ON public.restaurant_dish_submissions;
CREATE TRIGGER update_restaurant_dish_submissions_updated_at
BEFORE UPDATE ON public.restaurant_dish_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can create their dish submissions" ON public.restaurant_dish_submissions;
CREATE POLICY "Users can create their dish submissions"
ON public.restaurant_dish_submissions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Users can view their dish submissions" ON public.restaurant_dish_submissions;
CREATE POLICY "Users can view their dish submissions"
ON public.restaurant_dish_submissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update pending dish submissions" ON public.restaurant_dish_submissions;
CREATE POLICY "Users can update pending dish submissions"
ON public.restaurant_dish_submissions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE TABLE IF NOT EXISTS public.restaurant_official_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid,
  dish_id uuid NOT NULL,
  claim_id uuid,
  image_url text,
  storage_path text,
  caption text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_official_photos_status_allowed CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT restaurant_official_photos_image_present CHECK (image_url IS NOT NULL OR storage_path IS NOT NULL),
  CONSTRAINT restaurant_official_photos_caption_length CHECK (caption IS NULL OR char_length(caption) <= 180)
);

ALTER TABLE public.restaurant_official_photos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_restaurant_official_photos_user_status ON public.restaurant_official_photos (user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_official_photos_dish_status ON public.restaurant_official_photos (dish_id, status);

DROP TRIGGER IF EXISTS update_restaurant_official_photos_updated_at ON public.restaurant_official_photos;
CREATE TRIGGER update_restaurant_official_photos_updated_at
BEFORE UPDATE ON public.restaurant_official_photos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can create their official photo submissions" ON public.restaurant_official_photos;
CREATE POLICY "Users can create their official photo submissions"
ON public.restaurant_official_photos
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Users can view their official photo submissions" ON public.restaurant_official_photos;
CREATE POLICY "Users can view their official photo submissions"
ON public.restaurant_official_photos
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can view approved official photos" ON public.restaurant_official_photos;
CREATE POLICY "Anyone can view approved official photos"
ON public.restaurant_official_photos
FOR SELECT
USING (
  status = 'approved'
  AND EXISTS (
    SELECT 1 FROM public.dishes d
    WHERE d.id = restaurant_official_photos.dish_id
      AND d.is_published = true
  )
);

DROP POLICY IF EXISTS "Users can update pending official photo submissions" ON public.restaurant_official_photos;
CREATE POLICY "Users can update pending official photo submissions"
ON public.restaurant_official_photos
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE TABLE IF NOT EXISTS public.restaurant_boost_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid,
  dish_id uuid NOT NULL,
  claim_id uuid,
  requested_boost_score numeric NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  budget_cents integer,
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_boost_requests_status_allowed CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  CONSTRAINT restaurant_boost_requests_score_range CHECK (requested_boost_score >= 0 AND requested_boost_score <= 25),
  CONSTRAINT restaurant_boost_requests_window_valid CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT restaurant_boost_requests_budget_range CHECK (budget_cents IS NULL OR (budget_cents >= 0 AND budget_cents <= 100000000))
);

ALTER TABLE public.restaurant_boost_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_restaurant_boost_requests_user_status ON public.restaurant_boost_requests (user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_boost_requests_dish_status ON public.restaurant_boost_requests (dish_id, status);

DROP TRIGGER IF EXISTS update_restaurant_boost_requests_updated_at ON public.restaurant_boost_requests;
CREATE TRIGGER update_restaurant_boost_requests_updated_at
BEFORE UPDATE ON public.restaurant_boost_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can create their boost requests" ON public.restaurant_boost_requests;
CREATE POLICY "Users can create their boost requests"
ON public.restaurant_boost_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Users can view their boost requests" ON public.restaurant_boost_requests;
CREATE POLICY "Users can view their boost requests"
ON public.restaurant_boost_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update pending boost requests" ON public.restaurant_boost_requests;
CREATE POLICY "Users can update pending boost requests"
ON public.restaurant_boost_requests
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status = 'pending');