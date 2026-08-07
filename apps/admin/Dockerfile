FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/admin/package.json ./apps/admin/package.json
RUN npm install --workspace=@cpaas/admin --include-workspace-root

FROM deps AS build
COPY apps/admin ./apps/admin
WORKDIR /app/apps/admin
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
