I’ll simplify the main feed layout so it feels more like a clean, card-first feed.

Planned changes:

1. Remove the top header bar
- Delete the sticky PlateLoop/search/sign-in header from the top of the app.
- Adjust the main content spacing so the feed starts at the top naturally without leaving a header-sized gap.
- Update the desktop side navigation sticky offset so it no longer accounts for the removed header.

2. Remove the “Discover” title above the feed
- Remove the “Discover” word/title row from the discover feed.
- Keep the loading behavior, but move the loading spinner into the feed area only if needed so the page doesn’t reintroduce a visible heading bar.

3. Keep sign-in inside the Account tab
- The Account tab already shows a sign-in card when the user is logged out.
- I’ll leave sign-in access there and remove the separate top-header sign-in button.
- Existing protected actions like saving, reviewing, or creating lists will still prompt sign-in when needed.

Technical details:
- Primary file to update: `src/pages/Index.tsx`.
- No database changes needed.
- No authentication logic changes needed; this is a layout/navigation cleanup only.