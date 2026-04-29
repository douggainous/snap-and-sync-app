I’ll make a targeted mobile-first responsiveness fix focused only on layout stability.

Root cause identified so far:
- `src/App.css` still contains the default Vite `#root` desktop container styles (`max-width: 1280px`, `padding: 2rem`, `text-align: center`). Even if not currently imported, it is a risky desktop-first global style and should be neutralized so it cannot force tablet/desktop sizing if imported later.
- The app lacks explicit global `html`, `body`, and `#root` width/overflow safeguards. This allows individual wide children to create horizontal page scroll.
- Several mobile surfaces rely on full-width panels with negative margins, large fixed text, fixed minimum heights, and horizontal chip rows. Most are intentionally visual-first, but they need stronger `min-w-0`, `max-w-full`, `overflow-hidden`, and mobile-specific sizing so a 320–390px viewport cannot be widened by content.
- Dish detail currently uses very large default mobile headings (`text-5xl`) and fixed tall media minimums (`min-h-[620px]`) that crowd smaller phones. This does not require a redesign, only mobile-safe sizing.
- Modal/form shells are mostly responsive, but need viewport-bounded max height/width and internal overflow so they cannot exceed small mobile widths.

Files/components to fix:
1. `src/index.css`
   - Add global layout hardening:
     - `html`, `body`, `#root { width: 100%; max-width: 100%; min-height: 100%; }`
     - `body { overflow-x: hidden; }`
     - `#root { overflow-x: clip; }` with safe fallback where appropriate.
   - Add `box-sizing` and media/image safety if needed:
     - `img, video, canvas, svg { max-width: 100%; }`
   - Preserve current theme and visual design.

2. `src/App.css`
   - Remove/override the default desktop-first `#root` max-width/padding/center styles so it cannot cause tablet layout or horizontal overflow.
   - Keep this as a safety cleanup only; no UX changes.

3. `src/pages/Index.tsx`
   - Root/page shell:
     - Ensure `<main>` and primary containers include `w-full max-w-full overflow-x-hidden`.
     - Ensure grid/content wrappers use `min-w-0` and mobile-first widths.
   - Header/nav:
     - Keep mobile bottom nav visible on mobile and desktop/sidebar hidden until `md`.
     - Add `min-w-0`, `shrink-0`, and responsive button text handling so the sign-in/header area cannot force width.
     - Make bottom nav use `left/right` inset safely within viewport and cap with `max-w` only on larger screens if needed.
   - Dish detail/feed:
     - Keep the dish-first image experience but make media containers width-safe with `w-full max-w-full overflow-hidden`.
     - Reduce default mobile heading sizes and only scale up with `sm/md` classes.
     - Replace mobile fixed/tall minimums that overflow small devices with `svh`-based responsive minimums.
     - Ensure action rows can wrap or shrink instead of widening the viewport.
   - Search/profile/collections/want-to-try:
     - Add `min-w-0`, `max-w-full`, and overflow containment to cards/grids.
     - Keep horizontal chip/filter rows intentionally scrollable inside their own containers, not the whole page.
   - Forms/modals:
     - Make modal panels `max-w-[calc(100vw-1.5rem)]`, `max-h-[calc(100svh-1.5rem)]`, and internally scrollable where necessary.
     - Ensure inputs/buttons remain `w-full` or wrap on narrow screens.

Validation plan after implementation:
- Test the same route `/items/meat-lovers-pizza-689eb287` and main app surfaces at:
  - 320px
  - 360px
  - 390px
  - 430px
  - 768px
  - desktop width
- For each viewport, confirm:
  - No horizontal page scrollbar.
  - Mobile bottom nav appears below `md`.
  - Desktop/sidebar nav appears only at `md` and above.
  - Header, feed card, dish detail, search, profile, collections, and modal/form surfaces fit within viewport.
  - Images remain responsive with `object-cover` and do not force overflow.

No backend logic, data model, ranking, API behavior, or product functionality will be changed.