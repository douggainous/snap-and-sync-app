Plan to make the discovery feed feel populated without needing a Google Maps API key:

1. Add a large simulated restaurant/dish dataset
   - Expand the current 3 sample dishes into a richer feed of many realistic restaurant/menu-item cards.
   - Include varied cuisines, ratings, review counts, prices, descriptions, tags, neighborhoods/cities, and placeholder imagery/gradients.

2. Make simulated items behave like real feed content
   - Keep large images/visual placeholders and prominent ratings.
   - Preserve infinite scrolling by paging through the simulated content when backend results are empty.
   - Avoid repeating the same cards too quickly.

3. Keep Google Maps support but make it optional
   - Leave the existing backend function in place for later.
   - If Google Places fails or the key is invalid, silently fall back to simulated nearby content instead of showing a blocking error.
   - Show friendly copy like “Demo nearby picks” rather than “Google Maps not connected.”

4. Keep the review CTA requirement
   - If a simulated dish has zero reviews, show `Be first to review this!`.
   - For reviewed dishes, keep the normal review CTA.

5. Improve the initial empty state
   - On first load, the discovery feed should immediately show a full scrollable set of simulated items, even if the database has no menu items yet.
   - Search should filter the simulated feed when no real matching data exists.

Technical notes
- Main implementation will be in `src/pages/Index.tsx`.
- No database migration is needed.
- No API key or external setup will be required.
- The existing backend Google Places function can remain available for future real-data integration.