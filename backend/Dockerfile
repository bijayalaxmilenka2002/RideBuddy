# Small, reproducible image for any container host (Render, Railway, Fly.io,
# Cloud Run). The build needs no secrets: everything is read from the
# environment at runtime.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Copy manifests first so the dependency layer is cached across code changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Run as the unprivileged user that the base image already provides.
USER node

EXPOSE 5000

# The health route reports the database link, not just the process, so an
# instance that cannot reach Mongo is not sent traffic.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
