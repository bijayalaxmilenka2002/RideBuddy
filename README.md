# RideBuddy

Ride pooling and fare splitting. People travelling from similar pickup points to
similar destinations discover each other, join a temporary ride pool, split the
fare, and coordinate the journey over a private ride chat.

Supported vehicles: **Bike**, **Auto**, **Cab**.

## Status of this codebase

This is the local baseline. See `docs/BASELINE.md` for exactly what is
implemented, what is not, and what could not be verified in the environment this
was built in.

## Repository layout

```
backend/    Node.js + Express + MongoDB (Mongoose) + Socket.IO API
frontend/   React + Vite + React Router client
docs/       Baseline notes and design reference
```

## Running locally

### The quick way: one command

Works the same in Windows PowerShell, macOS and Linux. You need Docker Desktop.

```bash
docker compose up
```

That starts MongoDB, the API and the web client together. Then open
<http://localhost:5173>. No MongoDB install, no Atlas account, no `.env` to
fill in. The database persists in a Docker volume between runs.

In a second terminal, fill it with demo commuters and ride pools:

```bash
docker compose exec api npm run seed
```

It prints the logins it creates (all with the password `ridebuddy123`).

| Service | URL | Notes |
| --- | --- | --- |
| Web client | <http://localhost:5173> | Vite dev server, hot reload |
| API | <http://localhost:5000> | REST + Socket.IO |
| Health probe | <http://localhost:5000/api/health> | Reports the database link |
| MongoDB | `mongodb://localhost:27017/ridebuddy` | Exposed for Compass etc. |

Stop with `Ctrl+C`; `docker compose down -v` also deletes the database volume.

### The manual way

You need Node.js 18+ and a MongoDB instance (local `mongod` or a free Atlas
cluster). From the repository root, `npm run install:all` installs both halves,
and `npm run dev:api` / `npm run dev:web` run them in two terminals.

#### Backend

```bash
cd backend
cp .env.example .env      # then fill in MONGO_URI and JWT_SECRET
npm install
npm run seed              # optional: demo users and rides
npm run dev               # http://localhost:5000
```

Check it is up: `curl http://localhost:5000/api/health` — it reports the
database connection, not just the process, and returns 503 when Mongo is
unreachable.

#### Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:5000`, so no frontend
env var is needed in development. For a deployed backend, set `VITE_API_URL`.

## Business rules (enforced server-side)

| Vehicle | Total capacity | Composition           |
| ------- | -------------- | --------------------- |
| BIKE    | 2              | 1 admin + 1 co-rider  |
| AUTO    | 3              | 1 admin + 2 co-riders |
| CAB     | 3              | 1 admin + 2 co-riders |

- Capacity is derived from `vehicleType` on the server. A `maxCapacity` sent by
  the client is stripped by the validator and ignored.
- `vacancies = maxCapacity - members.length`. The admin occupies a seat.
- A ride flips `OPEN → LOCKED` automatically when it fills, and drops out of
  ride discovery. A co-rider leaving frees the seat and flips it back to `OPEN`.
- Seat allocation is a single atomic conditional update, so two riders taking
  the last seat at the same moment cannot both succeed.
- Ride status: `OPEN`, `LOCKED`, `COMPLETED`, `CANCELLED`.
- `individualFare = totalFare / members.length`, shown once the admin enters the
  real fare after booking.
- Only the ride admin can cancel, complete, set the fare, or see the
  ride-hailing hand-off links. The admin cannot be replaced.
- Only accepted members can read or post in a ride's chat.
- The admin cannot leave a ride (that would orphan the pool); the admin cancels.

## API

```
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/auth/me

POST   /api/rides                 create a ride (you become admin)
GET    /api/rides                 discovery; ?vehicleType=&lng=&lat=&radiusKm=
GET    /api/rides/:id
POST   /api/rides/:id/join
PATCH  /api/rides/:id/cancel      admin only
PATCH  /api/rides/:id/complete    admin only
PATCH  /api/rides/:id/fare        admin only
GET    /api/rides/:id/messages    members only
```

```
GET    /api/rides/mine               every ride you are part of, locked ones included
POST   /api/rides/:id/leave          a co-rider gives up their seat
GET    /api/health                   liveness + database state (503 when Mongo is down)
```

Socket.IO events (JWT in the handshake): `ride:join`, `ride:leave`,
`message:send`, and the broadcast `message:new`. Membership is re-checked
against the database on every join and every message.

## How the client uses the API

| Screen | Calls |
| --- | --- |
| `/` landing | none (public marketing page) |
| `/signup`, `/login` | `POST /auth/signup`, `POST /auth/login` |
| `/rides` discovery | `GET /rides`, plus `?lng=&lat=&radiusKm=` behind the **Near me** button, and `POST /rides/:id/join` |
| `/rides/mine` | `GET /rides/mine` |
| `/rides/new` | `POST /rides` |
| `/rides/:id` | `GET /rides/:id`, `POST /rides/:id/leave`, the three admin `PATCH`es, `GET /rides/:id/messages`, and the Socket.IO chat events |

Every authenticated request carries `Authorization: Bearer <token>`; the token
is stored in `localStorage` and attached by `frontend/src/lib/api.js`.

## Design

The front end follows the published RideBuddy site: its landing page was rebuilt
from that site's markup, using the same structure, copy and `lucide-react`
icons. The palette is reconstructed from the hex values that appear inline in
that markup (teal `#0A7C6E`, amber `#F59E0B`), since the compiled stylesheet was
not available, and the display font is a stand-in - see `docs/BASELINE.md` for
exactly what is copied and what is inferred.

Every colour, size, radius and shadow resolves through
`frontend/src/styles/tokens.css`, so re-skinning is a one-file edit.

## Environment variables

Nothing is hard-coded. Copy the examples and edit:

| File | Variable | Required | Purpose |
| --- | --- | --- | --- |
| `backend/.env` | `MONGO_URI` | **yes** | Connection string |
| | `JWT_SECRET` | **yes** | Signs tokens; any long random string |
| | `PORT` | no (5000) | API port |
| | `NODE_ENV` | no | `development` / `production` |
| | `JWT_EXPIRES_IN` | no (7d) | Token lifetime |
| | `CORS_ORIGINS` | no | Comma-separated browser origins |
| | `UBER_CLIENT_ID` | no | Attribution only on the hand-off link |
| `frontend/.env` | `VITE_API_URL` | no | API base URL; unset uses the dev proxy |
| | `VITE_DEV_API_TARGET` | no | Where `npm run dev` proxies to |
| `./.env` | `JWT_SECRET`, `CORS_ORIGINS` | no | Optional overrides for Docker Compose |

The API refuses to start without `MONGO_URI` and `JWT_SECRET`, and prints what
to set rather than a stack trace. `VITE_*` values are compiled into the browser
bundle, so never put a secret in them.

## Tests and checks

```bash
cd backend
npm test                   # 58 pass here; the 28 database tests skip without Mongo
npm run test:unit          # business rules + the HTTP stack, no database needed
npm run test:integration    # full flow; needs MONGO_URI

cd ../frontend
npm run lint               # ESLint, including the React hooks rules
npm run build              # production build
```

`test:unit` covers fare splitting, capacity derivation, GeoJSON validation, the
zod schemas, JWT handling, booking links, and the Express stack (auth, CORS,
helmet, body limits, error shapes). `test:integration` drives signup → create →
join → lock → fare → chat → leave over real HTTP against a real database,
including a concurrency test that proves the last seat cannot be oversold. It
writes only to a throwaway database it drops afterwards.

## Deploying

`docs/DEPLOYMENT.md` walks through a free deployment end to end: a MongoDB Atlas
M0 cluster and a Render free web service, neither of which needs a card. The
repository ships `render.yaml` and `backend/Dockerfile`.

## Security

bcrypt password hashing, JWT auth, protected routes, admin and membership
authorization, zod input validation (which also strips unknown keys, so a
client cannot set `maxCapacity` or `status`), centralized error handling,
Helmet, a CORS allow-list, and rate limiting - tighter on the auth endpoints,
and a separate token bucket on the chat socket. Password hashes are excluded
from queries by default and never serialized.

**Contact details stay inside a pool.** `GET /rides` and `GET /rides/:id`
return names only to a caller who is not a member; email and phone are added
for members, who need them to coordinate. Without that, any account could page
through discovery and harvest every user's phone number.

All secrets come from environment variables, and every `.env` is gitignored.

## Repository layout notes

`docker-compose.yml` runs the whole stack; `backend/Dockerfile` builds the API
image for any container host; `render.yaml` is a one-click Render blueprint.
The root `package.json` only holds convenience scripts - it has no
dependencies.
