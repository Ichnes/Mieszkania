FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --ignore-scripts
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright PORT=3001 HOST=0.0.0.0
# Use the exact Playwright version from package-lock for browser compatibility.
RUN npx playwright install --with-deps chromium \
    && apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/storage && chown -R node:node /app/storage /ms-playwright /app/node_modules

FROM dependencies AS build
COPY --chown=node:node apps ./apps
COPY --chown=node:node packages ./packages
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node tsconfig.base.json ./
RUN npm run build && chown -R node:node /app/packages /app/node_modules/.vite-temp

FROM build AS api
USER node
EXPOSE 3001
CMD ["node", "--import", "tsx", "apps/api/src/index.ts"]

FROM build AS api-dev
USER node
ENV NODE_ENV=development
CMD ["sh", "-c", "npm run build -w @mieszkania/shared && node --import tsx apps/api/src/index.ts"]

FROM build AS web-dev
USER node
ENV NODE_ENV=development API_PROXY_TARGET=http://api:3001
EXPOSE 5173
CMD ["sh", "-c", "npm run build -w @mieszkania/shared && npm run dev -w @mieszkania/web"]

FROM nginx:stable-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
