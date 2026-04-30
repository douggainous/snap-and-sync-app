I’ll make the feed and detail images feel much more stable by keeping already-loaded images visible, preloading likely next images, and avoiding skeleton flicker when navigating.

Plan:

1. Add a reusable stable image component
- Create a small in-memory image cache for image URLs during the current app session.
- Track image load state per URL so a previously loaded feed image does not flash back to an empty skeleton when it appears elsewhere.
- Keep the current image visible until the next image finishes loading instead of swapping to an empty state.
- Use a soft opacity fade-in only on first load.
- Respect `loading`, `decoding`, `fetchPriority`, `sizes`, and dimensions for feed vs detail contexts.

2. Use stable images in the Discover feed and search cards
- Replace raw `<img>` tags in `FeedItemCard` and `SearchDishCard` with the stable image component.
- Prevent the pulsing skeleton from showing over images that are already cached or loaded.
- Make above-the-fold feed images load eagerly/high priority while keeping lower items lazy.
- Add a subtle placeholder only for genuinely unloaded images.

3. Smooth the transition from feed card to details
- When a user taps a feed/search card, record the clicked dish image URL as the “transition image”.
- On the detail page, render the exact same cached image URL immediately in the hero so it does not reload from empty.
- Add a short route-level crossfade/scale transition so the detail hero feels like it continues from the card instead of blinking.
- Remove/soften any animation that makes the detail image appear to reload unnecessarily.

4. Preload detail and nearby feed images
- Preload the first few feed images after feed data arrives.
- On hover/touch-start/focus of a card, preload that item’s detail image before navigation completes.
- Add lightweight browser hints (`new Image()`, `decode()` when supported) without blocking the UI.

5. Preserve feed state when returning from details
- Avoid clearing or refetching the feed when navigating into a detail route.
- Keep the existing item list mounted/stateful where possible so returning to the feed doesn’t create unnecessary image churn.
- Ensure pull-to-refresh still intentionally refreshes the feed, but normal navigation does not.

6. Polish CSS for perceived performance
- Adjust `.image-skeleton` so it doesn’t animate behind loaded images.
- Add stable background colors and `will-change` only where helpful.
- Ensure images use `draggable={false}` and no browser drag ghosting on touch.

Technical notes:
- Most of this will be contained in `src/pages/Index.tsx`, with a small CSS adjustment in `src/index.css` if needed.
- No database changes are needed.
- I’ll avoid editing generated backend integration files.
- I’ll verify the main flows at the current mobile viewport: Discover feed initial load, tapping into details, and back to feed.