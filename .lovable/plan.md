Plan to update the signed-in header account control:

1. Avatar trigger
- Replace the current plain “Sign out” button with a circular user avatar icon in the top header.
- Use the existing warm food palette for the avatar background and hover/focus states.
- Keep the existing “Sign in” button for logged-out users.

2. Account dropdown options
- Add a dropdown menu opened from the avatar.
- Include the user email at the top when available.
- Add menu actions for:
  - Profile: switches to the Account/Profile view
  - Favorites: switches to the Lists/Favorites view
  - Reviews: navigates to the Account/Profile area for now, where review history can be surfaced later
  - Sign out: signs the user out

3. UX/accessibility polish
- Use the existing accessible dropdown menu component from the UI library.
- Add clear icons for each option using the existing Lucide icon set.
- Make menu items keyboard-friendly and keep the header compact on mobile.

Technical details:
- Update imports in `src/pages/Index.tsx` for the dropdown menu components and any needed icons.
- Add a small `AccountMenu` component in `src/pages/Index.tsx` to keep the header clean.
- Wire the dropdown actions into existing `setView`, `navigate`, and `supabase.auth.signOut()` behavior.
- No database changes are needed for this UI update.