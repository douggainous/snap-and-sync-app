Plan to align the app around the 3 primary outcomes

Core product model to implement:
1. Discovering food the user has never had before
2. Rating and remembering food the user has had
3. Remembering food the user wants to eat in the future

This means the main actions should map cleanly to:
- Discover: Find, share, add to “I want to try” or another list
- Scan/Rate: Capture and review food already eaten
- Lists/Profile: Remember, organize, and revisit past/future food

1. Update Discover interaction pattern
- Treat Discover as “new food to try,” not a place for rating food already eaten.
- Update Discover feed card actions to:
  - Want to try: primary save-for-future action
  - Share: lightweight discovery action
  - Add to list: available through long-press on Want to try on mobile, and a secondary menu/button on desktop
- Remove “Save/Favorite” language from Discover cards where it implies the user already likes the dish.
- Rename UI copy from “Save” to “Want to try” or “Add to list” depending on context.
- Keep tapping the card/image/title as the path to dish details.

2. Make “I want to try” the automatic default list
- When a user taps Want to try in Discover:
  - Toggle the existing `want_to_try` saved action.
  - Ensure a private collection named “I want to try” exists for that user.
  - Add the dish to that collection automatically.
- If the user untoggles Want to try:
  - Remove or deactivate the `want_to_try` saved action.
  - Optionally remove the dish from “I want to try” only, while preserving it in any custom collections.
- This preserves fast interaction: one tap immediately remembers the dish for later.

3. Long-press list selection on mobile
- Add long-press handling to the Discover card Want to try button.
- Mobile behavior:
  - Tap: quick-add to “I want to try.”
  - Long press: open a bottom-sheet list picker.
- Desktop behavior:
  - Click Want to try: quick-add to “I want to try.”
  - Add a small “List” or overflow action for choosing a specific list.
- List picker should show:
  - “I want to try” default
  - User-created lists like “Desserts,” “London,” “Top Steaks”
  - Create new list inline
- Selecting a list should also mark the dish as `want_to_try`, because adding to a future-food list means the user wants to try it.

4. Clarify Lists as future-food collections
- Rename the bottom nav “Lists” experience around remembering future dishes, not generic favorites.
- Lists should support user-created collections such as:
  - Desserts
  - London
  - Top Steaks
  - Date Night
  - Cheap Eats
- Existing `collections` and `collection_dishes` tables are the right fit for this feature.
- Avoid expanding the older `favorite_lists` system unless needed for compatibility; future UX should center on `collections` for dish planning.

5. Add curated automatic collections
- Generate lightweight curated list sections from existing behavior, without heavy ML and without blocking the feed.
- Examples:
  - “Desserts to try” from saved dessert-tagged dishes
  - “Steaks you saved” from dish type tags + want-to-try
  - “Loved Italian” from high ratings/reviews
  - “Try next near you” from want-to-try dishes with nearby restaurants
  - “More like your 5-star dishes” from ratings + cuisine/tag affinity
- These can be computed dynamically from existing tables first:
  - `ratings`
  - `reviews`
  - `saved_items`
  - `dish_tags`
  - `collections`
  - `collection_dishes`
  - `user_taste_profiles`
- No new AI calls are required for the initial version.

6. Separate “had it” vs “want it” everywhere
- “Had it” actions should live in Scan, dish detail, and profile history:
  - Rate
  - Review
  - Remember
  - Would order again
- “Want it” actions should live in Discover and Search:
  - Want to try
  - Add to list
  - Share
- Dish detail can include both groups, but visually separate them:
  - “Plan this” section: Want to try, Add to list, Directions
  - “Had this?” section: Rate/review

7. Data model approach
- Use existing `saved_items` for quick user intent:
  - `action_type = 'want_to_try'` for future intent
  - `action_type = 'favorite'` should be reserved for stronger positive signal, preferably after rating/reviewing or from detail/profile
- Use existing `collections` for user-defined lists.
- Use existing `collection_dishes` for list membership.
- Ensure every user gets or lazily creates a private “I want to try” collection.
- No schema migration should be required unless the current database lacks a unique constraint for `collections(user_id, slug)` or `collection_dishes(collection_id, dish_id)`. If missing, add only those constraints/indexes so upserts are reliable and fast.

8. Implementation details
- Update `src/pages/Index.tsx`:
  - Rename Discover card action copy.
  - Add mobile long-press handling for Want to try.
  - Reuse and improve `SaveToCollectionModal` as an “Add to list” bottom sheet.
  - Make the modal default to “I want to try” and support inline list creation.
  - Update `toggleDishAction` so Want to try also adds to the default collection.
  - Stop auto-opening collection modal on every quick save; only open it on long press or explicit list selection.
- Update Lists/Profile UI:
  - Present user collections as planning lists.
  - Add curated sections based on reviewed vs want-to-try behavior.
  - Clarify empty states around the three app outcomes.

9. Performance and reliability
- Keep Discover feed fast: no blocking AI, no extra feed-time AI calls.
- Lazy-create “I want to try” only when needed.
- Use upserts for collection membership to avoid duplicates.
- Keep list picker data small and user-scoped.
- Curated lists should be computed from cached/stored data and limited result sets.
- If list save fails, the `want_to_try` action should fail gracefully with a clear toast and not break browsing.

10. UX copy direction
- Discover card:
  - Primary: “Want to try”
  - Secondary: “Share”
  - Long press hint: “Hold to choose a list”
- Lists page:
  - “Plan future bites”
  - “Create lists like Desserts, London, or Top Steaks.”
- Profile/history:
  - “Food you’ve had”
  - “Dishes to revisit”
  - “Rated recently”

Result
- Discover becomes about finding new food.
- Scan/Rate becomes about remembering food already eaten.
- Lists become the planning layer for future meals.
- Every major interaction now leads to one of the three core outcomes instead of feeling like generic social-app actions.