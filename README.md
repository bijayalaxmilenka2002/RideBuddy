# RideBuddy

Ride pooling and fare splitting. People travelling from similar pickup points to
similar destinations discover each other, join a temporary ride pool, split the
fare, and coordinate the journey over a private ride chat.

Supported vehicles: **Bike** (2 seats), **Auto** (3), **Cab** (3).

---

## 1. Architecture

```
Browser
  │  fetch + Socket.IO   (JWT in the Authorization header / handshake)
  ▼
React SPA  (frontend/)  ──────────────────────────────────────────────┐
                                                                      │
Express API  (backend/)                                               │
  routes → middleware (auth, validation) → controller → service → model
                                                                      │
MongoDB  (Mongoose)  ◀────────────────────────────────────────────────┘
```

Every request follows one path: **route → middleware → controller → service →
Mongoose model → MongoDB**, and back as JSON. Controllers stay thin (read the
request, call a service, send a response); business rules live in services so
they can be changed in one place and unit-tested without HTTP.

| Layer | Folder | Responsibility |
| --- | --- | --- |
| Routes | `src/routes/` | URL → middleware chain → controller. No logic. |
| Middleware | `src/middleware/` | Auth, ride access, rate limits, error handling |
| Validators | `src/validators/` | zod schemas; parse and **strip** unknown keys |
| Controllers | `src/controllers/` | HTTP in, HTTP out; status codes; response shape |
| Services | `src/services/` | Business rules: capacity, fare, requests, auth |
| Models | `src/models/` | Mongoose schemas, indexes, hooks |
| Sockets | `src/sockets/` | Socket.IO auth and the ride chat |
| Utils | `src/utils/` | `ApiError`, `asyncHandler`, JWT, fare maths |
| Config | `src/config/` | Env loading, DB connection, business constants |

### Technology

- **Frontend** — React 18, Vite 5, React Router 6, plain CSS with design tokens,
  `socket.io-client`, `lucide-react` icons. No CSS framework, no state library:
  server state is fetched per screen, auth lives in a React context.
- **Backend** — Node.js 18+, Express 4, Mongoose 8, Socket.IO 4, zod,
  jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit.
- **Database** — MongoDB 7 with a `2dsphere` index for "rides near me".
- **Tests** — Node's built-in test runner (`node --test`). No extra framework.

Everything runs locally. There is no third-party backend service.

---

## 2. Folder structure

```
RideBuddy/
├── backend/
│   ├── src/
│   │   ├── config/        constants.js  db.js  env.js
│   │   ├── controllers/   auth  ride  rideRequest  message  user
│   │   ├── middleware/    auth  rideAccess  rateLimit  errorHandler
│   │   ├── models/        User  Ride  RideRequest  Message
│   │   ├── routes/        index  auth.routes  ride.routes  user.routes
│   │   ├── services/      auth  ride  rideRequest  message  user  booking
│   │   ├── sockets/       index  auth.socket  chat.socket
│   │   ├── utils/         ApiError  asyncHandler  jwt  fare
│   │   ├── validators/    index (+ one schema file per resource)
│   │   └── app.js         Express app: middleware + routes
│   ├── scripts/seed.js    demo data
│   ├── tests/             unit / http / integration
│   ├── server.js          HTTP + Socket.IO server, graceful shutdown
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/    Navbar RideCard RideRequests ChatPanel Logo …
│   │   ├── context/       AuthContext.jsx
│   │   ├── lib/           api.js  socket.js  format.js
│   │   ├── pages/         Landing Login Signup Rides MyRides CreateRide
│   │   │                  RideDetail Profile NotFound
│   │   ├── styles/        tokens.css  global.css
│   │   ├── App.jsx        routes
│   │   └── main.jsx
│   └── .env.example
├── docker-compose.yml     MongoDB + API + web, one command
└── docs/                  DEPLOYMENT.md, BASELINE.md
```

---

## 3. Environment variables

Nothing is hard-coded and no secret is committed. Copy the examples:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env   # optional
```

**`backend/.env`**

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `MONGO_URI` | **yes** | — | MongoDB connection string |
| `JWT_SECRET` | **yes** | — | Signs tokens. Any long random string |
| `PORT` | no | `5000` | API port |
| `NODE_ENV` | no | `development` | `development` / `production` / `test` |
| `JWT_EXPIRES_IN` | no | `7d` | Token lifetime |
| `CORS_ORIGINS` | no | `http://localhost:5173` | Comma-separated browser origins |
| `UBER_CLIENT_ID` | no | — | Attribution only on the hand-off link |

```ini
# backend/.env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/ridebuddy
JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN=7d
CORS_ORIGINS=http://localhost:5173
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**`frontend/.env`** — `VITE_*` values are compiled into the browser bundle, so
**never put a secret in one**.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | no | API base URL. Unset uses the dev proxy (same origin) |
| `VITE_DEV_API_TARGET` | no | Where `npm run dev` proxies `/api` and `/socket.io` |

The API refuses to start without `MONGO_URI` and `JWT_SECRET`, and prints what
to set instead of a stack trace.

---

## 4. Installation and running

### Option A — Docker (everything, one command)

```bash
docker compose up
```

Starts MongoDB, the API and the web client. Open <http://localhost:5173>.
The API waits for MongoDB's healthcheck, so ordering is handled for you.

Seed demo data in a second terminal:

```bash
docker compose exec api npm run seed
```

`docker compose down` stops it; add `-v` to delete the database volume too.

**Reading the output.** MongoDB logs a lot; lines marked `"s":"I"` are
informational, not errors. To check the stack rather than read the scroll, use a
second terminal:

```bash
docker compose ps              # all three containers, and mongo's health
docker compose logs api --tail 20   # just the API's own output
```

### Option B — run each part yourself

**1. Start MongoDB**

- *Docker (easiest):* `docker run -d -p 27017:27017 --name ridebuddy-mongo -v ridebuddy-data:/data/db mongo:7`
- *Windows:* install MongoDB Community Server; it runs as a service on `27017`. Otherwise `"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath C:\data\db`
- *macOS:* `brew services start mongodb-community`
- *Linux:* `sudo systemctl start mongod`
- *No install at all:* create a free MongoDB Atlas cluster and paste its URI into `MONGO_URI` (see `docs/DEPLOYMENT.md`).

**2. Start the backend**

```bash
cd backend
npm install
npm run seed      # optional demo data
npm run dev       # http://localhost:5000
```

Check it: <http://localhost:5000/api/health> → `{"status":"ok","database":"connected"}`

**3. Start the frontend**

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
```

From the repository root, `npm run install:all`, `npm run dev:api` and
`npm run dev:web` do the same without changing directory.

### Seeded logins

All use the password `ridebuddy123`:
`asha@example.com`, `priya@example.com`, `sanjay@example.com`, `arjun@example.com`.
Sanjay runs a ride that screens its riders and Arjun has a request pending on
it, so the accept/reject flow has something to show immediately.

---

## 5. Database models

**User** — `name`, `phone` (unique), `email` (unique, lowercased),
`password` (bcrypt, `select: false` so it never leaves the database by
accident), timestamps.
`comparePassword()` and `toPublicJSON()` are the only ways it is read out.

**Ride** — `admin` (User), `vehicleType` (`BIKE|AUTO|CAB`), `maxCapacity`
(**derived on the server** from the vehicle type), `pickupLocation` and
`dropLocation` (GeoJSON `Point` + `name`), `departureTime`, `members` (Users,
including the admin), `status` (`OPEN|LOCKED|COMPLETED|CANCELLED`), `totalFare`,
`approvalRequired`, timestamps.
Indexes: `2dsphere` on `pickupLocation`, and `{status, departureTime}`.
Virtual: `vacancies = maxCapacity − members.length`.

**RideRequest** — `ride`, `rider`, `status`
(`PENDING|ACCEPTED|REJECTED|WITHDRAWN`), `message`, `respondedAt`, timestamps.
Unique compound index on `{ride, rider}`, so re-applying reuses one row.

**Message** — `rideId`, `sender`, `senderName`, `message`, `timestamp`.
Indexed on `{rideId, timestamp}`.

---

## 6. Authentication flow

1. `POST /api/auth/signup` or `/login` → the server verifies (bcrypt) and
   returns `{ user, token }`. The password hash is never serialized.
2. The client stores the JWT in `localStorage` and `lib/api.js` attaches
   `Authorization: Bearer <token>` to every request.
3. `requireAuth` verifies the signature and expiry, loads the user, and puts it
   on `req.user`. A bad or expired token is `401`.
4. On reload, `AuthContext` calls `GET /api/auth/me` to restore the session; a
   rejected token is discarded.
5. Socket.IO takes the same JWT in the handshake, and **re-checks ride
   membership against the database on every join and every message** — a room
   cannot be entered or posted to by a non-member.

**Authorization** is per ride, not a global role:

| Who | Can |
| --- | --- |
| Any signed-in user | Discover rides, view a ride, join or request to join |
| Ride member | Read and post in the chat, see co-riders' contact details, leave |
| Ride admin (the creator) | Set the fare, complete, cancel, see hand-off links, accept/reject requests |

The admin cannot be replaced and cannot leave (they cancel instead), so a pool
is never left without an owner.

---

## 7. API endpoints

All responses are JSON. Errors are always `{ "error": { "message": string, "details"?: [...] } }`.
Status codes: `200` ok, `201` created, `400` validation, `401` unauthenticated,
`403` not allowed, `404` missing, `409` conflict, `429` rate limited, `500` server.

### Auth
| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | — | Create an account, returns a token |
| POST | `/api/auth/login` | — | Sign in, returns a token |
| GET | `/api/auth/me` | ✔ | The current user |

### Profile
| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/users/me` | ✔ | Profile plus ride counts |
| PATCH | `/api/users/me` | ✔ | Update name and/or phone |
| PATCH | `/api/users/me/password` | ✔ | Change password (needs the current one) |

### Rides
| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/rides` | ✔ | Create a ride; you become its admin |
| GET | `/api/rides` | ✔ | Discovery — see filters below |
| GET | `/api/rides/mine` | ✔ | Every ride you are on, locked ones included |
| GET | `/api/rides/:id` | ✔ | Ride detail |
| POST | `/api/rides/:id/join` | ✔ | Take a free seat (unscreened rides) |
| POST | `/api/rides/:id/leave` | ✔ | Give up your seat (co-riders only) |
| PATCH | `/api/rides/:id/fare` | admin | Enter the real fare |
| PATCH | `/api/rides/:id/complete` | admin | Mark completed |
| PATCH | `/api/rides/:id/cancel` | admin | Cancel |
| GET | `/api/rides/:id/messages` | member | Chat history |

**Discovery filters** on `GET /api/rides`:
`?vehicleType=BIKE|AUTO|CAB` · `?q=<text>` (matches pickup or drop name,
regex-escaped) · `?from=&to=` (departure window) · `?lng=&lat=&radiusKm=`
(geospatial, GeoJSON order) · `?limit=` (max 50).

### Join requests (rides created with `approvalRequired: true`)
| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/rides/:id/requests` | ✔ | Apply, with an optional note |
| GET | `/api/rides/requests/mine` | ✔ | Your own applications |
| PATCH | `/api/rides/:id/requests/mine/withdraw` | ✔ | Take yours back |
| GET | `/api/rides/:id/requests` | admin | The queue for this ride |
| PATCH | `/api/rides/:id/requests/:requestId/accept` | admin | Seat the rider |
| PATCH | `/api/rides/:id/requests/:requestId/reject` | admin | Decline |

### Other
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness **and** database state; `503` when Mongo is down |

**Socket.IO** (JWT in the handshake): `ride:join`, `ride:leave`,
`message:send` → broadcast `message:new`.

---

## 8. Main application workflow

1. **Sign up / log in** → token stored, session restored on reload.
2. **Create a ride** — pick vehicle, pickup and drop (coordinates), departure
   time, and whether you want to approve riders. Capacity comes from the
   vehicle type; a `maxCapacity` sent by a client is stripped and ignored. You
   become the admin and take the first seat.
3. **Discover** — browse open rides, filter by vehicle, search by place name or
   departure window, or use **Near me** for a radius search around your GPS
   position.
4. **Join** — either take a free seat instantly, or, on a screened ride, send a
   request with a note and wait for the admin to accept or reject it.
5. **The ride fills** — the seat is granted by a single atomic conditional
   update, so two riders cannot take the last seat; a full ride flips
   `OPEN → LOCKED` in the same operation and drops out of discovery. If an
   accept fills the last seat, everyone still waiting is rejected rather than
   left hanging.
6. **Coordinate** — members get each other's phone numbers and a private
   real-time chat.
7. **Split the fare** — after booking, the admin enters the real fare and the
   server computes `individualFare = totalFare / members.length`.
8. **Finish** — the admin marks the ride completed or cancels it. A co-rider
   who leaves frees their seat and re-opens the ride. Everything stays visible
   under **My rides**.

Business rules are enforced **server-side**, never in the browser.

---

## 9. Tests and checks

```bash
cd backend
npm test                  # unit + HTTP + integration (DB tests skip without Mongo)
npm run test:unit         # business rules + Express stack, no database needed
npm run test:integration  # full flow; needs MONGO_URI

cd ../frontend
npm run lint              # ESLint, including the React hooks rules
npm run build             # production build
```

`test:integration` writes only to a throwaway database named
`ridebuddy_test_<pid>_<id>` which it drops afterwards, so pointing `MONGO_URI`
at a real cluster never touches your data.

---

## 10. Deploying

`docs/DEPLOYMENT.md` covers a free deployment end to end: a MongoDB Atlas M0
cluster and a Render free web service, neither of which needs a card. The repo
ships `render.yaml` and `backend/Dockerfile`.

---

## 11. Security

bcrypt password hashing (cost 12), JWT auth, protected routes, per-ride
admin/membership authorization, zod validation that strips unknown keys,
centralized error handling that never leaks internals on a 500, Helmet, a CORS
allow-list, REST rate limiting (tighter on auth) and a separate token bucket on
the chat socket.

**Contact details stay inside a pool** — discovery and a ride viewed by a
non-member return names only; email and phone are added for members, who need
them to coordinate.

All secrets come from environment variables and every `.env` is gitignored.
