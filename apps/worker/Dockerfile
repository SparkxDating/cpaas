FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps/worker/package.json ./apps/worker/package.json
RUN npm install --workspace=@cpaas/worker --include-workspace-root

FROM deps AS build
COPY . .
RUN npm run generate -w @cpaas/database
RUN npm run build -w @cpaas/common
RUN npm run build -w @cpaas/logger
RUN npm run build -w @cpaas/auth
RUN npm run build -w @cpaas/events
RUN npm run build -w @cpaas/database
RUN npm run build -w @cpaas/worker

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/worker/package.json ./apps/worker/package.json
CMD ["node", "apps/worker/dist/main.js"]
