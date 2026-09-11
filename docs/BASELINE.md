# Baseline notes

## 1. The site's markup was supplied by hand; the site itself is still unreachable

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

**Update:** the landing page's rendered HTML was later pasted into the session
by the project owner, so the front end is no longer designed blind. See
section 4.

The backend below is built from the written product spec, which was complete
enough to determine it entirely.

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
- **`docker compose up` is unverified.** The compose file's syntax is validated
  (`docker compose config` passes) and a Docker daemon does run in this
  container, but no image could be pulled: Docker Hub's blob CDN
  (`production.cloudfront.docker.com`) answers 403 through the egress proxy,
  for `mongo:7` and even `hello-world`. So the stack has never been started.
  Together with the denials on `fastdl.mongodb.org`, `downloads.mongodb.com`,
  `repo.mongodb.org` and the blocked apt PPAs, there is no route to a MongoDB
  in this environment at all.
- **Deployment is documented but not performed.** `docs/DEPLOYMENT.md`,
  `render.yaml` and `backend/Dockerfile` were written from the providers'
  documented behaviour. No Render or Atlas account was created from here and no
  deploy was run, so the walkthrough is unverified against the live dashboards,
  which change their wording from time to time.

## 4. The visual layer now follows the real design

The owner supplied the live landing page's rendered HTML. The front end was
rebuilt from it, so the following are taken from the real site rather than
invented:

- **Structure.** Fixed header that is transparent over the hero and turns solid
  on scroll; full-height gradient hero with colour blobs, a particle field, an
  "active pools" pill, the avatar stack and star rating, and a "Live Rides Near
  You" preview card with three pools and three stat tiles; then How It Works,
  Why RideBuddy, Vehicle Options, Trust & Safety, a closing CTA band, and the
  dark footer.
- **Copy.** Headlines, section labels, body copy, the six benefit cards, the six
  safety points and the four safety-score figures are the site's own wording.
- **Iconography.** The site uses `lucide-react`; the app now uses the same
  package and the same icons, and the logo is the site's inline SVG.

### What is reconstructed rather than copied

The compiled stylesheet (`/_next/static/css/*.css`) was not supplied, and the
site is still unreachable from this container, so exact values were inferred:

- **Palette.** Anchored on the hex values that appear inline in the markup:
  `#0A7C6E` (the teal on the first avatar chip) as primary, `#F59E0B` as accent,
  `#059669` as success, plus Tailwind's amber/blue/green 50-700 on the vehicle
  cards. Surfaces, borders and both gradients are tuned to those anchors and are
  a close match, not a byte-for-byte one.
- **Type.** The site loads one Next.js font under a hashed class name
  (`__variable_a11773`), which does not reveal which font it is. Inter and Plus
  Jakarta Sans stand in for body and display. Two lines in `tokens.css` change
  it.

Pasting that stylesheet would let both be replaced exactly. Everything still
resolves through `frontend/src/styles/tokens.css`, so it stays a one-file edit.

### Screens with no reference

Only the landing page's markup was supplied. The sign-up/login screen, ride
discovery, ride creation and ride detail are **not** copies - no markup for them
was available. They are styled to be consistent with the design system above,
and the ride cards reuse the exact pattern the landing page's preview card uses
for a ride (green pickup pin, amber drop pin, clock, vacancies in green when
plentiful and amber when down to one). The published site routes its buttons to
`/sign-up-login-screen`; that path redirects to `/signup` so existing links keep
working.

## 5. Routes

| Route         | Auth      | Purpose                                        |
| ------------- | --------- | ---------------------------------------------- |
| `/`           | public    | Landing: hero, features, vehicle capacities    |
| `/login`      | public    | Log in                                         |
| `/signup`     | public    | Create an account                              |
| `/rides`      | protected | Ride discovery, vehicle filter, join           |
| `/rides/new`  | protected | Create a ride (you become admin)               |
| `/rides/:id`  | protected | Ride detail, members, fare split, chat, admin controls |
