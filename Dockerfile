FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --ignore-scripts
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY tsconfig.base.json ./
RUN npm run build

FROM build AS api
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright PORT=3001 HOST=0.0.0.0
# Use the exact Playwright version from package-lock for browser compatibility.
RUN npx playwright install --with-deps chromium \
    && apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/storage && chown -R node:node /app/storage /ms-playwright
USER node
EXPOSE 3001
CMD ["node", "--import", "tsx", "apps/api/src/index.ts"]

FROM nginx:stable-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
