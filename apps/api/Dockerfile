FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
RUN npm install --workspace=@cpaas/api --include-workspace-root

FROM deps AS build
COPY . .
RUN npm run generate -w @cpaas/database
RUN npm run build -w @cpaas/common
RUN npm run build -w @cpaas/logger
RUN npm run build -w @cpaas/auth
RUN npm run build -w @cpaas/events
RUN npm run build -w @cpaas/database
RUN npm run build -w @cpaas/api

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/package.json ./package.json
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
