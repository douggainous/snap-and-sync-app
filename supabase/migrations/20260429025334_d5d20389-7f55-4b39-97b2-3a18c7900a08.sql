ALTER TYPE public.saved_item_type ADD VALUE IF NOT EXISTS 'favorite';

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS favorite_count INTEGER NOT NULL DEFAULT 0;
