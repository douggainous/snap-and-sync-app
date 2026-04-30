I’ll update the dish/post detail experience so it feels like a place-focused info page rather than a rating flow.

Plan:

1. Add a back arrow in the upper-left of the detail page
- Place it over the hero image in the upper-left, styled as a round translucent button.
- It will return the user to the previous page when possible, otherwise route back to the main Discover feed.
- Keep share/copy controls on the opposite side.

2. Make the detail image feel immersive
- Adjust the detail page layout so the hero image reaches the top and side edges of the mobile viewport, rather than sitting inside the normal feed padding.
- Add a scroll-responsive hero treatment: the image stays visually prominent at the top, while a gradient fade at the bottom transitions into the content below.
- Preserve a smooth transition from feed card to detail by using similar image proportions, rounded-corner reduction on mobile, and a subtle enter animation.

3. Shift the detail page away from rating-first content
- Remove the prominent “Rate this dish” call-to-action from the hero.
- Move reviews/ratings lower on the page or de-emphasize them so the detail page focuses on learning about the post and restaurant.
- Keep rating functionality available in the app’s create/scan flow rather than making it the primary action here.

4. Add a restaurant information section
- Make the main content include the restaurant name, address/city, distance when available, cuisine/type, price level, current business status if present, phone, website, email, and map/directions actions.
- Add clear action buttons for:
  - Want to try / bookmark
  - Directions
  - Call
  - Website
  - Share
- If exact hours, reservations, dine-in, carryout, delivery, Uber Eats, or DoorDash links are not currently stored in the database, I’ll display graceful “Not listed yet” style rows rather than fake data.

5. Add ordering/reservation affordances where possible
- If the restaurant website is available, provide an “Order / menu” link to the website as the safest existing destination.
- Add placeholders/disabled rows for reservations, delivery, DoorDash, and Uber Eats when no structured links exist yet.
- Technical note: the current restaurant schema does not appear to include hours, reservations, dine-in/carryout/delivery flags, or third-party ordering URLs. I will not invent those values. If you want those to be real editable data later, a follow-up backend migration can add those fields.

Technical details:
- Main file to update: `src/pages/Index.tsx`.
- Existing `Restaurant` and `MenuItem` types will be extended locally only for optional future fields if needed, without changing generated backend type files.
- The existing detail fetch already loads restaurant fields like phone, website, email, address, maps URL, rating, review count, price level, and business status.
- I’ll avoid editing generated integration files.