# SPDX-FileCopyrightText: 2024 CalmStudio contributors
# SPDX-License-Identifier: Apache-2.0
#
# Build CalmStudio (static SvelteKit SPA) and serve it with nginx.
#
# From the monorepo root (architecture-as-code/):
#
#   docker build -f calm-studio/Dockerfile -t calm-studio .
#   docker run --rm -p 5173:80 calm-studio
#
# Open http://localhost:5173
#

# ---- build ----
FROM node:26.3.1-bookworm-slim AS build

WORKDIR /src
ENV HUSKY=0
ENV CI=true

COPY package.json package-lock.json .npmrc .nvmrc tsconfig.base.json ./

# Root package.json lists many workspaces; stub unused ones so npm can resolve
# the lockfile while we only copy the packages CalmStudio needs.
RUN node --input-type=module -e "\
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';\
import { createRequire } from 'node:module';\
const require = createRequire(import.meta.url);\
const pkg = require('./package.json');\
for (const w of pkg.workspaces) {\
  if (w.includes('*')) continue;\
  mkdirSync(w, { recursive: true });\
  const pj = w + '/package.json';\
  if (!existsSync(pj)) {\
    writeFileSync(pj, JSON.stringify({ name: w.replaceAll('/', '-'), private: true, version: '0.0.0' }));\
  }\
}\
"

COPY calm ./calm
COPY calm-models ./calm-models
COPY calm-studio ./calm-studio

RUN npm pkg delete scripts.prepare \
 && npm install --no-audit --no-fund \
    --workspace=calm-models \
    --workspace=@calmstudio/calm-core \
    --workspace=@calmstudio/extensions \
    --workspace=@calmstudio/studio \
 && npm explore esbuild -- node install.js

RUN npm run build --workspace=calm-models \
 && npm run build --workspace=@calmstudio/calm-core \
 && npm run build --workspace=@calmstudio/studio

# ---- runtime ----
FROM nginx:1.27-alpine

COPY calm-studio/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/calm-studio/apps/studio/build /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
