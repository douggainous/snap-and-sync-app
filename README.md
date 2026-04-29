# PlateLoop production deployment

PlateLoop is a dish-first food discovery app built with React, Vite, Lovable Cloud, private image storage, and backend functions for dish capture, feed ranking, search, interactions, nearby restaurants, and AI dish recognition.

## 1. Required services

- **Lovable Cloud database**: stores users, restaurants, dishes, photos, ratings, reviews, saved dish actions, tags, lists, follows, posts, and aggregate rollups.
- **Lovable Cloud authentication**: email/password and Google sign-in. Email confirmation is expected unless explicitly disabled for testing.
- **Lovable Cloud file storage**: private buckets for dish photos, food post images, and avatars. Public image display uses signed URLs generated server-side.
- **Lovable AI**: real AI image recognition through backend functions using the server-only `LOVABLE_API_KEY`.
- **Google Maps API**: optional but required for live nearby restaurant enrichment through `GOOGLE_MAPS_API_KEY`.
- **Frontend hosting**: Lovable Publish is the most appropriate hosting path for this stack because Lovable Cloud environment variables and backend functions are managed together. Vercel can host the static Vite frontend if the same public frontend variables point to the Lovable Cloud backend.

## 2. Required environment variables

### Frontend build variables

These are public browser variables and are required at build time:

| Variable | Required | Used for |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Backend API, auth, storage, and functions URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Browser-safe key for auth and function calls |
| `VITE_SUPABASE_PROJECT_ID` | Recommended | Project metadata and function URL construction if needed |

Do not add server-only secrets to frontend hosting variables.

### Backend/runtime secrets

These are server-only Lovable Cloud secrets used by backend functions:

| Secret | Required | Used for |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Backend client URL |
| `SUPABASE_ANON_KEY` | Yes | Authenticated user validation in protected functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side database/storage writes and signed URL generation |
| `LOVABLE_API_KEY` | Yes | Lovable AI dish recognition |
| `GOOGLE_MAPS_API_KEY` | Optional | Nearby restaurant lookup |

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, or `GOOGLE_MAPS_API_KEY` in frontend code or Vercel public variables.

## 3. Local build/test command

Use the same commands locally and in CI:

```bash
bun install
bun run lint
bun run test
bun run build
```

Preview the production bundle:

```bash
bun run preview
```

## 4. Production deployment steps

### Recommended: Lovable Publish

1. Confirm Lovable Cloud is active and healthy.
2. Confirm authentication providers are enabled for email/password and Google.
3. Confirm backend runtime secrets exist: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, and optionally `GOOGLE_MAPS_API_KEY`.
4. Run all database migrations in `supabase/migrations` against the production backend.
5. Deploy backend functions:
   - `capture-dish`
   - `dish-interaction`
   - `dish-feed`
   - `dish-search`
   - `nearby-restaurants`
   - `upload-dish-photo`
   - `analyze-food`
6. Publish the frontend with Lovable Publish.
7. After publishing, run the smoke test checklist below against the published URL.

### Vercel static frontend option

Use this only if you want Vercel to host the static React app while Lovable Cloud remains the production backend.

1. Import the repository into Vercel.
2. Set framework preset to **Vite**.
3. Set install command: `bun install`.
4. Set build command: `bun run build`.
5. Set output directory: `dist`.
6. Add only these frontend environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
7. Do not add server-only runtime secrets to Vercel unless you add Vercel server functions. This app’s backend functions run in Lovable Cloud.
8. Keep the included `vercel.json` rewrite so deep links such as `/search`, `/dish/:slug`, and `/lists/:slug` load the SPA.
9. Add the Vercel production domain to the authentication redirect/site URL allowlist in Lovable Cloud auth settings.

## Database migration/setup instructions

Run every SQL file in `supabase/migrations` in timestamp order for a fresh environment. The production database must include:

- Dish-first tables: `dishes`, `photos`, `ratings`, `reviews`, `saved_items`, `tags`, `dish_tags`.
- Restaurant and location data: `restaurants`.
- User/profile data: `users`, `profiles`, `favorite_lists`, `favorite_list_items`, `follows`.
- Search fields and indexes for dish-first search.
- Rollup functions for dish aggregates and trending score.
- RLS policies that scope writes to authenticated users and allow public reads only for published/public data.
- Uniqueness constraints that prevent duplicate ratings and saved/favorite actions.

After migrations, verify the database has triggers attached for dish rollups. If the database function exists but triggers are missing, aggregates will not update correctly.

## Storage bucket setup instructions

The production storage layer must include these private buckets:

- `dish-photos` for dish capture and AI recognition uploads.
- `food-post-images` for legacy/social post images.
- `avatars` for user profile images.

Buckets should remain private. Backend functions upload files and generate signed URLs for feed/search rendering. Required storage policies:

- Authenticated users can upload to their own folder/path.
- Users can read/update/delete their own uploaded objects when needed.
- Public direct bucket reads are not required because the app serves signed URLs.

## AI API key setup instructions

Lovable AI requires the server-only `LOVABLE_API_KEY` runtime secret. It is managed by Lovable Cloud and must only be read inside backend functions. The browser must never call Lovable AI directly.

AI behavior in production:

- `capture-dish` sends uploaded dish images to Lovable AI.
- AI returns a dish-name suggestion, tags, confidence, and status.
- Results are persisted on `photos` using `ai_dish_name`, `ai_tags`, `ai_confidence`, `ai_status`, and `ai_error`.
- If AI is unavailable, rate-limited, or out of credits, dish creation still persists and the function returns a clear fallback status.

## Security checks

- Protected write functions validate the `Authorization` header and resolve the authenticated user server-side.
- `SUPABASE_SERVICE_ROLE_KEY` is used only in backend functions, never in browser code.
- `LOVABLE_API_KEY` is used only in backend functions, never in browser code.
- Dish creation, ratings, reviews, saves, favorites, lists, comments, and uploads must require authenticated users.
- Public reads must be limited to published dishes, public photos, public reviews, public tags, public restaurants, and public lists.
- Private storage buckets must not be made public unless the access model is redesigned.
- Feed/search endpoints can read public published content but must not return private user data or server-only paths without signed URLs.
- Authentication redirect URLs must include all production domains.

## Error handling for missing environment variables

- Frontend startup validates `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` before rendering the app.
- Backend functions return `500` with a safe generic message when required server secrets are missing.
- AI failures return safe status messages and do not block core dish persistence.
- Location/nearby errors degrade gracefully to the dish feed.

## 5. Post-deployment smoke test checklist

- Create a new account with a strong password and confirm email.
- Log in with the confirmed account.
- Sign out and log back in.
- Upload a real dish photo from the production domain.
- Create a dish with restaurant name, rating, review, price, and tags.
- Confirm the photo appears from a signed URL.
- Confirm AI status/tags are stored on the photo record.
- Confirm the dish appears in **Recently added** feed.
- Rate the dish and confirm aggregate rating/rating count updates.
- Save the dish as “want to try” and confirm save/want-to-try counts update.
- Favorite the dish and confirm favorite count updates.
- Refresh the page and confirm interactions persist.
- Search for the created dish by name.
- Search with natural queries such as “best steak near me” and “trending desserts”.
- Test cuisine, rating, trending, recent, and location filters.
- Verify unauthenticated users can view public feed/search but cannot create, rate, save, favorite, or upload.
- Verify backend function responses do not expose server-only secrets, storage paths without signed URLs, or private user data.
- Check production console and function logs for errors after each flow.