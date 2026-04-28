Revised plan: make this an SEO-first food discovery app centered on menu items, not restaurant-level reviews.

## Core product direction

The app should work like a public search/discovery engine for specific dishes:
- Users can search “pork belly bao taco”, “fish tacos”, “best birria ramen”, or “crispy duck noodles”.
- Results show individual menu items with ratings, photos, price, distance, restaurant, reviews, and directions.
- Accounts are optional for browsing, searching, viewing reviews, opening directions, and sharing public pages.
- Accounts are required only when storing user-owned data: saving reviews, publishing confirmed menu items, favorites/lists, past scans/history, liking, commenting, and following.

## SEO-first architecture

### Public indexable pages
Create public routes that can be shared and indexed:
- `/` — public food discovery homepage.
- `/search?q=pork+belly+bao+taco` — searchable discovery results.
- `/items/:slug` — individual menu item page.
- `/restaurants/:slug` — restaurant page focused on its menu items.
- `/lists/:slug` — shareable favorites/food trail list.
- `/cuisine/:slug`, `/city/:slug`, `/dish/:slug` — landing pages for high-intent searches.

### SEO metadata
Add structured metadata for public pages:
- Dynamic page titles and descriptions based on dish, restaurant, city, cuisine, rating, and price.
- Open Graph/Twitter sharing images and descriptions.
- JSON-LD structured data for:
  - Restaurant
  - Menu/MenuItem where applicable
  - Review
  - AggregateRating
  - BreadcrumbList
- Human-readable URLs using slugs, e.g. `/items/pork-belly-bao-taco-at-luna-kitchen`.

Note: because this is a Vite/React app, SEO will be optimized with route-level metadata and structured data. If later you need maximum search engine rendering performance at large scale, the next evolution would be server-rendered or prerendered public pages.

## Public discovery experience

### Search results
Search results should prioritize specific menu items, not businesses:
- Dish/menu item name.
- Restaurant and neighborhood/city.
- Item rating and review count.
- Distance from user when location permission is granted.
- Price or price range.
- Photo preview.
- Tags like spicy, crispy, vegetarian, value, brunch, late-night.
- Quick actions: directions, share, favorite, view reviews.

### Location and directions
Add location-aware discovery:
- Ask for location only when needed.
- Show distance from the user on results and item pages.
- Add “Walking directions” and “Driving directions” buttons.
- Open Apple Maps/Google Maps/browser maps using the restaurant coordinates or address.
- Support fallback when location is unavailable by showing city/neighborhood context.

### Item detail pages
Each menu item page should show:
- Dish name as the primary headline.
- Restaurant context.
- Aggregate dish rating, number of reviews, current/typical price.
- Distance and directions.
- Photos from users.
- Review feed for that menu item.
- Similar dishes nearby.
- Share and favorite actions.

### Restaurant pages
Restaurant pages should emphasize food discovery:
- Top-rated menu items.
- Recently confirmed prices.
- Menu sections from crowdsourced scans.
- Individual item reviews.
- Restaurant-level details like address, hours placeholder, map/directions.

## Menu item crowdsourcing

### Scan menu flow
Replace the current “food post” mental model with:
1. Scan menu or receipt as a guest.
2. AI/OCR extracts multiple menu items, prices, sections, and descriptions without requiring login.
3. User confirms/edit extracted items locally.
4. User chooses which items to review.
5. Prompt for sign-in only when saving reviews, publishing confirmed menu items, or preserving scan history.

### Item review flow
Users review individual menu items:
- Item rating, not just restaurant rating.
- Review text.
- Photo of dish or menu reference.
- Price paid/menu price.
- Tags and dietary notes.
- Optional “would order again”.

## Favorites and sharing

### Personal favorites
Signed-in users can save menu items to favorites.

### Shareable lists
Users can create lists such as:
- “Best pork belly dishes in Austin”
- “My NYC ramen crawl”
- “Date-night desserts”
- “Top fish tacos near me”

Lists should support:
- Public/private visibility.
- Shareable URL.
- List title, description, cover image, and included menu items.
- SEO metadata for public lists.

## Account behavior

### Guests can
- Search and browse public items/restaurants/lists.
- View ratings, reviews, photos, and prices.
- Use distance/directions.
- Share public pages.
- Take or upload menu photos.
- Extract and edit menu items before deciding whether to save.

### Signed-in users can
- Confirm extracted menu items.
- Rate/review items.
- Upload photos.
- Like/comment/follow.
- Save favorites.
- Create/share lists.

Use lightweight sign-in prompts only at the moment a guest tries a protected action.

## Data model changes

Add/adjust backend tables around menu-item discovery:
- `menu_items`: canonical dish/menu item records tied to restaurants.
- `menu_item_reviews`: individual item ratings/reviews.
- `menu_photos`: uploaded menu/receipt images.
- `menu_extractions`: AI/OCR extraction result and confirmation status.
- `favorite_lists`: user-created lists.
- `favorite_list_items`: menu items saved into lists.
- Keep `restaurants` for context, location, and directions.
- Keep social tables for likes/comments/follows, but connect them to item reviews and/or menu items where appropriate.

Access rules:
- Public read for published menu items, restaurants, public reviews, and public lists.
- Authenticated write for scans, confirmations, reviews, favorites, lists, likes, comments, and follows.
- Users can edit/delete only their own contributions.

## AI extraction updates

Update the AI backend function to return multiple menu items from a menu/receipt photo:
- item name
- description
- section/category
- price
- currency
- confidence
- raw OCR text
- likely cuisine/tags

The frontend will show a confirmation screen before saving extracted items.

## Implementation order

1. Update public access rules so guests can browse published discovery data without an account.
2. Add menu-item, review, scan/extraction, favorites-list, and list-item tables.
3. Rebuild the homepage as public SEO-first discovery instead of login-first auth.
4. Add search results centered on menu item queries with rating, price, distance, directions, share, and favorite actions.
5. Add item detail, restaurant detail, and shareable list routes.
6. Replace posting flow with Scan Menu → Confirm Items → Review Menu Items.
7. Update AI extraction for multi-item menu/receipt OCR.
8. Add auth modal prompts only for protected actions.
9. Add route-level metadata, JSON-LD structured data, slugs, and share previews for SEO.
10. Test guest discovery, item search, directions, sharing, favorites, account-gated actions, and mobile camera scanning.