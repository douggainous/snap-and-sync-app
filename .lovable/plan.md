Build an end-to-end mobile-first food discovery app for restaurant meals, usable responsively on the web and packaged with a native wrapper for camera access.

## Product scope

The app will be a social/content discovery platform where users can:
- Sign up and log in.
- Create a profile with display name, avatar, bio, and food preferences.
- Capture restaurant food photos using the device camera.
- Post food reviews tied to restaurants and locations.
- Use AI-powered extraction to suggest food tags, cuisine, dish details, and OCR text from menus/receipts.
- Discover food posts from friends/followed users.
- Like, comment, save, and share posts.
- Search and filter by restaurant, dish, cuisine, tags, rating, and nearby location.

## App experience

### 1. Mobile-first shell
Create a polished responsive interface with:
- Bottom tab navigation for mobile: Feed, Discover, Camera/Post, Saved, Profile.
- Desktop/tablet responsive layout with wider feed and sidebar-style navigation where appropriate.
- Clean onboarding state for new users.
- Empty/loading/error states across the app.

### 2. Authentication and profiles
Use Lovable Cloud authentication with:
- Email/password login.
- Google sign-in.
- Forgot password and reset password flow.
- User profiles stored separately from auth users.
- Editable profile: avatar, display name, username, bio, dietary preferences, favorite cuisines.

### 3. Food post creation
Create a post flow optimized for mobile:
- Camera/photo capture entry point.
- Image preview and replace/remove controls.
- Restaurant name and location fields.
- Dish name, rating, review text, price, cuisine, tags, and visibility.
- Default visibility aligned with “friends/followers”.
- Save draft or publish.

### 4. AI-powered extraction
Add backend AI extraction using Lovable AI through an edge function, not from the browser:
- Analyze uploaded food/menu/receipt images.
- Suggest cuisine, dish category, ingredients, dietary tags, and descriptive tags.
- OCR menus/receipts to extract restaurant name, dish names, prices, and visible text.
- Surface rate-limit or credit errors clearly in the app.
- Let users review and edit AI suggestions before publishing.

### 5. Location-aware discovery
Add location metadata features:
- Request browser/device location permission only when needed.
- Suggest nearby restaurant context when creating a post.
- Store latitude/longitude when the user chooses to attach location.
- Discover/search posts by nearby restaurants, cuisine, tags, and ratings.

### 6. Social graph and sharing
Implement friends/followers-style sharing:
- Follow/unfollow profiles.
- Feed prioritizes followed users.
- Post visibility: followers, private draft, or public discoverable.
- Likes, comments, saved posts.
- Share button using native share when available, with web fallback.

### 7. Cloud data and file storage
Use Lovable Cloud database and storage for:
- Profiles and avatars.
- Food post images.
- Restaurants and location metadata.
- Posts, tags, likes, comments, follows, saves.
- Secure row-level access rules so users can only edit their own data, while visibility rules control what others can view.

### 8. Native mobile wrapper
Set up Capacitor for true native packaging:
- Initialize Capacitor with the app ID `app.lovable.b2933d1e2ef944818568712130ce8430` and app name `A Lovable project`.
- Configure the sandbox preview URL for live reload during development.
- Add native camera capability through Capacitor.
- Keep the app fully usable as a responsive web app.

## Technical notes

- Frontend: React, Vite, TypeScript, Tailwind CSS, existing shadcn/ui components.
- Backend: Lovable Cloud/Supabase for auth, database, storage, RLS, and edge functions.
- AI: Lovable AI via a Supabase Edge Function using the default model for multimodal extraction.
- Camera: web file/camera input fallback plus Capacitor camera support for native builds.
- Storage: Supabase Storage buckets with proper RLS policies for avatars and post images.
- Security: validate user inputs client-side and server-side, keep AI prompts and secrets in backend functions, and enforce database access with RLS.
- Roles, if later needed, will be stored in a dedicated user roles table rather than profiles.

## Implementation phases

1. Replace the placeholder page with the core responsive app shell, navigation, auth screens, and visual design system.
2. Add Lovable Cloud auth, profiles, database schema, storage buckets, and RLS policies.
3. Build the food feed, discovery, profile, follows, likes, comments, saves, and post detail views.
4. Build the camera/post creation flow with image upload and location metadata.
5. Add AI/OCR extraction edge function and connect it to the post creation flow.
6. Configure Capacitor native wrapper and camera integration.
7. Test the main flows: signup/login, profile edit, capture/upload, AI extraction, publish post, follow user, feed visibility, like/comment/save, and responsive layouts.

## Native build follow-up

After implementation, to run on a physical device or emulator, you will need to export/pull the project locally, install dependencies, add iOS and/or Android platforms, run the build, sync Capacitor, and launch through Xcode or Android Studio.