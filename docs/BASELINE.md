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

## 2b. Defects found by review and fixed

The code in section 2 had never been executed against a database, so it was
re-reviewed line by line. These were real defects, now fixed:

- **Any authenticated socket client could kill the server.** `ride:join` and
  `message:send` passed a client-supplied `rideId` straight to
  `Ride.findById`. A non-ObjectId string makes that throw a `CastError`, and
  neither handler had a `catch`, so the rejection went unhandled — which
  terminates the Node process. Handlers are now wrapped and the id is validated
  first.
- **The last seat could be sold twice.** `joinRide` checked capacity, then
  saved. Two concurrent joins both passed the check and both saved, putting
  three people on a bike. Joining is now one atomic conditional update whose
  capacity guard lives in the query, and the `OPEN → LOCKED` flip happens in the
  same round trip. `tests/integration/flow.test.js` fires three simultaneous
  joins at a one-seat ride and asserts exactly one wins.
- **Nobody could leave a ride.** The model's `LOCKED → OPEN` branch was
  unreachable because no code path ever removed a member. Added
  `POST /api/rides/:id/leave` (admins excluded — they cancel instead).
- **A locked ride became unreachable.** Discovery only lists open rides with a
  free seat, so once a ride filled, its own members could not find it again.
  Added `GET /api/rides/mine`.
- **The health check lied.** It returned `200 {"status":"ok"}` whenever the
  process was up, even with Mongo unreachable, so a hosting platform would route
  traffic to a broken instance. It now reports database state and returns 503
  when disconnected.
- **No graceful shutdown.** SIGTERM on every redeploy cut off in-flight
  requests. `server.js` now drains connections and closes Mongo.

## 3. What is NOT real

- **Still no end-to-end run against a database.** MongoDB is not installed in
  this container, and `fastdl.mongodb.org`, `downloads.mongodb.com` and
  `repo.mongodb.org` are all refused by the organization's egress policy, so no
  `mongod` could be obtained. Signup → create ride → join → chat has therefore
  **not** been executed here.

  What changed is that the gap is now measurable instead of merely stated: the
  25 tests in `backend/tests/integration/` drive that exact flow over real HTTP
  and report `SKIP no MongoDB at MONGO_URI` in this environment. Running
  `MONGO_URI=... npm run test:integration` against any Mongo — a local `mongod`
  or a free Atlas cluster — executes them for real. Until someone does that,
  treat the database-dependent paths as reviewed and covered, not proven.

  The 44 tests that need no database **do** pass here, and they are not trivial:
  fare splitting, capacity derivation, GeoJSON coordinate-order validation, the
  zod schemas (including the stripping of a client-supplied `maxCapacity`), JWT
  forgery and expiry, and the whole Express stack — auth rejection, CORS
  allow-listing, helmet headers, body-size limits, malformed JSON, and the error
  response shape.
- **No Uber / Ola / Rapido API integration.** `backend/src/services/booking.service.js`
  builds public deep links that pre-fill pickup and drop in the provider's own
  app or site. Nothing books, prices, or queries a provider. Rapido publishes no
  documented route-prefill link, so its entry is flagged `prefillsRoute: false`
  and the UI says so. A real integration would need partner credentials as
  environment variables; none are read today.
- **No place autocomplete.** Ride creation takes coordinates directly (with a
  "use my current location" button for pickup). A maps/places provider would
  replace those number inputs.
- **Deployment is documented but not performed.** `docs/DEPLOYMENT.md`,
  `render.yaml` and `backend/Dockerfile` were written from the providers'
  documented behaviour. No Render or Atlas account was created from here and no
  deploy was run, so the walkthrough is unverified against the live dashboards,
  which change their wording from time to time.

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
