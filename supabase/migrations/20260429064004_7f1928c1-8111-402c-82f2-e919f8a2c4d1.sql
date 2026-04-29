CREATE TABLE IF NOT EXISTS public.user_taste_profiles (
  user_id uuid PRIMARY KEY,
  cuisine_affinity jsonb NOT NULL DEFAULT '{}'::jsonb,
  tag_affinity jsonb NOT NULL DEFAULT '{}'::jsonb,
  engagement_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_interaction_at timestamp with time zone,
  refreshed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_taste_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their taste profile"
ON public.user_taste_profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_taste_profiles_refreshed_at ON public.user_taste_profiles(refreshed_at);
CREATE INDEX IF NOT EXISTS idx_user_taste_profiles_cuisine_affinity ON public.user_taste_profiles USING GIN(cuisine_affinity);
CREATE INDEX IF NOT EXISTS idx_user_taste_profiles_tag_affinity ON public.user_taste_profiles USING GIN(tag_affinity);