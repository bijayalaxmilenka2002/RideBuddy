# Deploying RideBuddy for free

Everything below has a free tier that needs no card and no subscription:
MongoDB Atlas for the database, Render for the API. Budget about 20 minutes.

You will end up with:

```
your frontend  ──HTTPS──▶  https://ridebuddy-api.onrender.com  ──▶  MongoDB Atlas
```

---

## 1. Create the database (MongoDB Atlas, free M0)

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>.
2. **Create a cluster** → choose the **M0 Free** tier → pick the region closest
   to you → Create.
3. **Database Access** → *Add New Database User*. Pick a username and a
   generated password. **Copy the password now** — it is shown once.
4. **Network Access** → *Add IP Address*. Render's free plan has no fixed
   outbound IP, so choose **Allow access from anywhere** (`0.0.0.0/0`). The
   database is still protected by the username and password.
5. **Database → Connect → Drivers** and copy the connection string. It looks
   like:

   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

6. Replace `<password>` with the real password and insert the database name
   `ridebuddy` before the `?`:

   ```
   mongodb+srv://asha:MyPassw0rd@cluster0.xxxxx.mongodb.net/ridebuddy?retryWrites=true&w=majority
   ```

   > If your password contains `@ : / ? # [ ] %`, URL-encode it — an `@` becomes
   > `%40`. An un-encoded symbol is the single most common cause of
   > "authentication failed".

That string is your `MONGO_URI`.

## 2. Generate a JWT secret

Any long random string. On any machine with Node:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

That is your `JWT_SECRET`. Treat it like a password: anyone holding it can mint
tokens for any account. Never commit it.

## 3. Deploy the API (Render, free plan)

This repository already contains `render.yaml`, so Render can configure itself.

1. Push this repository to GitHub (see the branch note at the end).
2. Go to <https://dashboard.render.com/select-repo?type=blueprint>, pick this
   repository, and Render reads `render.yaml`.
3. It will prompt for the values marked as secrets:
   - `MONGO_URI` → the string from step 1
   - `CORS_ORIGINS` → the exact origin of your frontend, e.g.
     `https://ridebuddy-t4qb37.public.builtwithrocket.new`
     (scheme and host, **no trailing slash**; comma-separate several)
   - `JWT_SECRET` → Render generates one for you
4. Deploy. When it finishes you get a URL like
   `https://ridebuddy-api.onrender.com`.

Check it:

```bash
curl https://ridebuddy-api.onrender.com/api/health
# {"status":"ok","database":"connected","uptime":12.4}
```

`"database":"connected"` is the part that matters. If it says `degraded`, the
API is running but cannot reach Atlas — re-check `MONGO_URI` and that Network
Access allows `0.0.0.0/0`.

> **Free-plan cold starts.** Render idles a free service after 15 minutes of no
> traffic; the next request takes ~30-50 seconds to wake it. That is the free
> tier working as designed, not a bug in the app.

### Prefer a different host?

`backend/Dockerfile` is a plain container image, so Railway, Fly.io and Cloud
Run all work the same way. Set the same four environment variables, and point
the health check at `/api/health`.

## 4. Point the frontend at the API

### The React client in this repository

Set one environment variable at build time:

```bash
# frontend/.env
VITE_API_URL=https://ridebuddy-api.onrender.com
```

Then deploy `frontend/` to Netlify, Vercel or Render Static (all free):
build command `npm run build`, publish directory `dist`.

### Your existing Rocket.new site

The Rocket-hosted site is a separate deployment that is not part of this
repository, so it cannot be rewired from here. In the Rocket project, set the
API base URL to your Render URL and make the app call these endpoints, sending
`Authorization: Bearer <token>` on every authenticated request. The contract is
in the API table in the root `README.md`; `frontend/src/lib/api.js` is a working
40-line reference implementation you can copy.

Whichever frontend you use, its origin **must** appear in `CORS_ORIGINS` on the
API, or the browser will block every request.

## 5. Verify end to end

```bash
API=https://ridebuddy-api.onrender.com

# create an account
curl -s -X POST $API/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Asha","email":"asha@example.com","phone":"9876543210","password":"correct-horse-battery"}'
```

Copy the `token` from the response, then:

```bash
TOKEN=paste-the-token-here

curl -s -X POST $API/api/rides \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"vehicleType":"AUTO",
       "pickupLocation":{"name":"Koramangala","coordinates":[77.6245,12.9352]},
       "dropLocation":{"name":"Whitefield","coordinates":[77.7499,12.9698]},
       "departureTime":"2030-01-01T10:00:00.000Z"}'

curl -s $API/api/rides -H "Authorization: Bearer $TOKEN"
```

Coordinates are `[longitude, latitude]` — that order is GeoJSON's, and swapping
them is the other common first-time error.

You can also run the real test suite against the deployed database:

```bash
cd backend
MONGO_URI='your-atlas-uri' npm run test:integration
```

That writes only to a scratch database named `ridebuddy_test_<pid>_<id>`, which
it drops afterwards; your `ridebuddy` data is untouched.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `CORS policy: No 'Access-Control-Allow-Origin'` | The frontend origin is missing from `CORS_ORIGINS`, or it has a trailing slash |
| `/api/health` says `degraded` | The API cannot reach Atlas: wrong password, un-encoded symbol in it, or Network Access not opened |
| `Missing required environment variable: MONGO_URI` at boot | The variable is not set on the host |
| First request of the day takes 40s | Render free-plan cold start |
| `401 Invalid or expired token` | Tokens last 7 days by default (`JWT_EXPIRES_IN`); log in again |
| Chat connects but no messages arrive | `VITE_API_URL` must be the API origin, and that origin must be in `CORS_ORIGINS` |
