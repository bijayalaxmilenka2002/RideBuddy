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

You need Node.js 18+ and a MongoDB instance (local `mongod` or a free Atlas
cluster).

### Backend

```bash
cd backend
cp .env.example .env      # then fill in MONGO_URI and JWT_SECRET
npm install
npm run dev               # http://localhost:5000
```

Check it is up: `curl http://localhost:5000/api/health`

### Frontend

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

## Design

The front end follows the published RideBuddy site: its landing page was rebuilt
from that site's markup, using the same structure, copy and `lucide-react`
icons. The palette is reconstructed from the hex values that appear inline in
that markup (teal `#0A7C6E`, amber `#F59E0B`), since the compiled stylesheet was
not available, and the display font is a stand-in - see `docs/BASELINE.md` for
exactly what is copied and what is inferred.

Every colour, size, radius and shadow resolves through
`frontend/src/styles/tokens.css`, so re-skinning is a one-file edit.

## Tests

```bash
cd backend
npm test              # everything; database tests skip if no Mongo is reachable
npm run test:unit     # business rules + the HTTP stack, no database needed
npm run test:integration   # full flow; needs MONGO_URI
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
authorization, zod input validation, centralized error handling, Helmet, CORS
allow-list, and rate limiting (tighter on the auth endpoints). Password hashes
are excluded from queries by default and never serialized. All secrets come
from environment variables; `.env` is gitignored.
