# Baseline notes

## 1. The existing Rocket AI site could not be inspected

`https://ridebuddy-t4qb37.public.builtwithrocket.new` is **unreachable from this
environment**. Every route out was denied by the network egress proxy:

| Attempt                              | Result                                   |
| ------------------------------------ | ---------------------------------------- |
| `curl` the site                       | `connect_rejected` — gateway 403 to CONNECT |
| WebFetch the site                     | `EGRESS_BLOCKED`                         |
| `builtwithrocket.new`, `rocket.new`   | same denial                              |
| A third-party text-extraction proxy   | same denial                              |

This is the organization network policy on this remote container, not a fault
with the site.

**Consequences, stated plainly:**

- No screenshot, no DOM, no CSS, no bundle from the live site was obtained.
- Nothing in this repository is derived from the original site's markup or
  styling. No claim is made that it matches.
- The original project's **source code was never accessed**. The GitHub repo
  this was built in was empty (no commits).

Everything below is built from the written product spec, which was complete
enough to determine the backend entirely.

## 2. What is real

Working, and exercised in this environment:

- Full Express API with the layered structure (config / controllers / models /
  routes / middleware / services / sockets / validators / utils).
- Mongoose models with a `2dsphere` index on `pickupLocation` for near-me
  discovery, and GeoJSON `[longitude, latitude]` points.
- Server-derived capacity, auto `OPEN → LOCKED` at capacity, `vacancies`
  virtual, fare split, JWT auth with bcrypt, admin/membership authorization,
  Helmet, CORS allow-list, rate limiting, zod validation, central error handler.
- Socket.IO chat with JWT handshake auth; ride membership re-checked against the
  database on every join and every message, so the room cannot be entered or
  posted to by a non-member.
- React client with routing, auth context, protected routes, ride discovery,
  ride creation, ride detail, chat, and loading / empty / error states.

Verified directly:

- `npm run build` on the frontend succeeds; the app renders at 1280px and 390px
  (screenshots taken in a headless browser).
- Backend modules load and wire up cleanly.
- Capacity derivation (BIKE 2, AUTO 3, CAB 3), the `vacancies` virtual, GeoJSON
  coordinate validation, fare split (₹300 / 3 = ₹100), and the stripping of a
  client-supplied `maxCapacity` were each asserted in a script.

## 3. What is NOT real

- **No end-to-end run against a database.** MongoDB is not installed in this
  container and `fastdl.mongodb.org` is blocked by the same egress policy, so
  signup → create ride → join → chat has **not** been executed. The code paths
  are written and reviewed, not runtime-proven. Run it against a local `mongod`
  or an Atlas cluster to confirm.
- **No Uber / Ola / Rapido API integration.** `backend/src/services/booking.service.js`
  builds public deep links that pre-fill pickup and drop in the provider's own
  app or site. Nothing books, prices, or queries a provider. Rapido publishes no
  documented route-prefill link, so its entry is flagged `prefillsRoute: false`
  and the UI says so. A real integration would need partner credentials as
  environment variables; none are read today.
- **No place autocomplete.** Ride creation takes coordinates directly (with a
  "use my current location" button for pickup). A maps/places provider would
  replace those number inputs.
- **No tests.** No test framework was added.

## 4. The visual layer is provisional

Because the original design could not be seen, the UI is deliberately plain and
built to be re-skinned cheaply rather than to guess at the brand:

- Every colour, font size, spacing step, radius and shadow resolves through
  `frontend/src/styles/tokens.css`. Matching the original palette and type is an
  edit to that one file — no component markup changes.
- Component styles sit next to their components (`Navbar.css`, `RideCard.css`,
  …), so a single component can be restyled in isolation.

To align this with the original site, any one of these unblocks it:

1. Screenshots of each page (desktop and mobile).
2. The site's HTML/CSS, or an export of the Rocket AI project.
3. Allow-listing `*.builtwithrocket.new` in the environment's network policy, at
   which point the site can be inspected directly.

## 5. Routes

| Route         | Auth      | Purpose                                        |
| ------------- | --------- | ---------------------------------------------- |
| `/`           | public    | Landing: hero, features, vehicle capacities    |
| `/login`      | public    | Log in                                         |
| `/signup`     | public    | Create an account                              |
| `/rides`      | protected | Ride discovery, vehicle filter, join           |
| `/rides/new`  | protected | Create a ride (you become admin)               |
| `/rides/:id`  | protected | Ride detail, members, fare split, chat, admin controls |
