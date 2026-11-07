FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
# Build-time dummy values only; supply real secrets at runtime.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV BETTER_AUTH_URL=http://localhost:3000
ENV BETTER_AUTH_SECRET=build-only-not-a-production-secret-0000000000
RUN NEXT_STANDALONE=1 npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
