I found why the app is not working: the current preview is blocked by TypeScript build errors in `src/pages/Index.tsx`, so the app cannot compile and render.

Plan to fix it:

1. Fix the public list card prop mismatch
   - `PublicListPage` renders `ItemCard` with an old `onSave` prop.
   - `ItemCard` now maps to `FeedItemCard`, which expects `onAddToList` instead.
   - Update that render to pass `onAddToList={onSave}` so public list cards open the collection/list modal correctly.

2. Fix the malformed collections select query
   - The current `collections` query has an extra closing parenthesis:
     `collection_dishes(dishes(...)))`
   - Correct it to a valid nested select:
     `collection_dishes(dishes(...))`
   - This removes the parser error that TypeScript is surfacing.

3. Verify the app compiles through the preview
   - After the small code fix, reload the preview and confirm the build-error overlay is gone.
   - Check that the Discover page renders, and that list-related actions still open the collection modal as intended.

No database changes are needed for this fix.