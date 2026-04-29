Plan to make Discover more intuitive and engaging

Direction selected:
- Feed style: Card stream
- Navigation: Dedicated bottom Search tab
- Ranking: Balanced discovery
- Feed actions: Save + Want to try

1. Discover becomes a pure endless feed
- Remove the search bar, suggestion chips, sort/cuisine/rating filters, and mode pills from the Discover page.
- Keep Discover focused on browsing dishes only.
- Use the existing backend `dish-feed` endpoint with balanced ranking weights so it blends quality, popularity, trending, freshness, and personalization.
- Keep infinite loading with the existing IntersectionObserver, but make the loading/caught-up states feel like part of the feed rather than a separate search-results area.

2. Replace full-screen reel cards with a card-stream layout
- Refactor the Discover item card from near full-screen reel cards into scroll-friendly feed cards.
- Each card should show:
  - Dish photo with readable overlay
  - Dish name
  - Restaurant name and distance/city when available
  - Rating and trend label when relevant
  - Price/review metadata
  - Two visible actions only: Save/Favorite and Want to try
- Preserve access to dish detail by tapping the card/image/title.
- Keep image overlays strong enough for WCAG contrast and avoid text directly on busy images without a gradient/surface.

3. Add a dedicated Search tab
- Extend the view model with a `search` view.
- Add Search to bottom navigation as its own tab instead of a floating center search button.
- On desktop sidebar navigation, add Search as a first-class item too.
- Search view will contain the current search/filter experience:
  - Search input
  - Location button
  - Suggested searches
  - Sort filter
  - Cuisine filter
  - Rating filter
  - Trending query chips
  - Search results grid
- Route `/search` should open the Search view automatically; `/` should default to Discover.

4. Keep filtering out of Discover but maintain discovery controls implicitly
- Discover will request balanced feed results using the existing `dish-feed` ranking system.
- Nearby/location can still improve ranking if the user taps location in Search/Profile, but Discover should not expose mode/filter controls directly.
- Search tab remains the place for explicit filters like distance, cuisine, rating, and query intent.

5. Interaction behavior
- Save/Favorite and Want to try remain lightweight in-feed actions.
- If signed out, tapping either action opens the existing sign-in prompt without breaking scroll flow.
- Remove the Review/Share action rail from Discover cards; share/detail/review can stay on the dish detail page.
- Keep feed loading fast: no new AI calls, no blocking calls, and no additional backend endpoints required.

6. Technical implementation notes
- Main file to update: `src/pages/Index.tsx`.
- Likely changes:
  - Update `View` type and `navItems` to include `search`.
  - Add route-derived behavior so `/search` selects Search and `/` selects Discover.
  - Split the current Discover JSX into two sections: `DiscoverFeed` behavior and `SearchView` behavior, or at least separate conditional branches.
  - Introduce/refactor a compact `FeedStreamCard` using existing semantic color tokens and component classes.
  - Update mobile bottom nav from 5 columns/floating search button to straightforward tabs: Discover, Search, Scan, Lists, Account.
  - Ensure infinite scroll works for both Discover and Search result contexts without duplicate requests.

7. Validation
- Verify Discover loads dishes immediately and keeps scrolling.
- Verify Search tab opens filters and query results.
- Verify `/search?q=...` still works.
- Verify Save and Want to try actions work for signed-in users and prompt guests.
- Verify no 401 nearby restaurant errors are surfaced for signed-out users.
- Verify card text contrast remains accessible after the layout refactor.