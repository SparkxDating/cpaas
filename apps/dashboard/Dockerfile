FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/dashboard/package.json ./apps/dashboard/package.json
RUN npm install --workspace=@cpaas/dashboard --include-workspace-root

FROM deps AS build
COPY apps/dashboard ./apps/dashboard
WORKDIR /app/apps/dashboard
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/dashboard/.next/standalone ./
COPY --from=build /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
