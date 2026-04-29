I found the large gap is not coming from backend loading or image content. It is caused by the current mobile discover layout structure in `src/pages/Index.tsx`:

1. The top header is sticky.
2. The discover content wrapper has its own padding/gap.
3. The search/filter block starts as a separate bordered section below that wrapper.
4. On mobile, the combined header height + wrapper spacing + search section border/padding creates a visibly oversized empty band between the header and search bar, matching the screenshot.

Plan:

1. Tighten only the mobile discover spacing
   - Reduce the vertical padding between the sticky header and the discover search section on small screens.
   - Keep desktop/tablet spacing unchanged by retaining larger `lg:` spacing.

2. Pull the mobile search section closer to the header
   - Adjust the discover search container classes around the line containing `Search dishes`.
   - Remove the unnecessary mobile top breathing room while preserving its current border, background, rounded desktop behavior, and filter/chip layout.

3. Preserve the current visual direction
   - No redesign.
   - No backend changes.
   - No changes to feed ranking, auth, capture/upload, or dish detail behavior.

4. Verify layout after the fix
   - Check the mobile discover screen at 320px, 360px, 390px, and 430px.
   - Confirm the gap is gone, no horizontal overflow returns, and the search/filter/chips still fit.

Technical target:

- `src/pages/Index.tsx`
  - Change the outer content section mobile padding from the current `py-3` to tighter top spacing such as `pt-0 pb-3`, while keeping `lg:py-6`.
  - If needed, change the discover search section from `py-3` to a tighter mobile top padding while preserving desktop `lg:` styles.