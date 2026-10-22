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
# Vite aliases @finos/calm-shared/* to source (generate-from-pattern).
COPY shared ./shared
COPY calm-studio ./calm-studio
# Bundled JSON packs: import.meta.glob from @calmstudio/extensions → repo-root extensions/packs.
COPY extensions ./extensions

RUN npm pkg delete scripts.prepare \
 && npm install --no-audit --no-fund \
    --workspace=calm-models \
    --workspace=@calmstudio/calm-core \
    --workspace=@calmstudio/extensions \
    --workspace=@calmstudio/studio \
 && npm install --no-save --no-audit --no-fund json-pointer loglevel \
 && npm explore esbuild -- node install.js

# Released schemas are no longer in the git tree. Studio imports them from calm/release.
COPY scripts/copy-calm-schemas.mjs scripts/copy-calm-schemas.mjs
RUN node --input-type=module -e "\
import { readFileSync } from 'node:fs';\
import { spawnSync } from 'node:child_process';\
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));\
const specs = [];\
for (const [name, spec] of Object.entries(pkg.devDependencies ?? {})) {\
  if (name === '@finos/calm-schema' || String(spec).startsWith('npm:@finos/calm-schema@')) {\
    specs.push(name + '@' + spec);\
  }\
}\
if (specs.length === 0) {\
  console.error('No @finos/calm-schema devDependencies');\
  process.exit(1);\
}\
const install = spawnSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', ...specs], { stdio: 'inherit' });\
if (install.status !== 0) process.exit(install.status ?? 1);\
" \
 && node scripts/copy-calm-schemas.mjs calm

# Empty serves the SPA at /. The Hub compose file passes /studio.
ARG BASE_PATH=
ENV BASE_PATH=${BASE_PATH}

# vite build only. `npm run build` also packs the portable app, and that script
# is not in the image context.
RUN npm run build --workspace=calm-models \
 && npm run build --workspace=@calmstudio/calm-core \
 && npm exec --workspace=@calmstudio/studio -- vite build

# ---- runtime ----
FROM nginx:1.27-alpine

ARG BASE_PATH=
ENV BASE_PATH=${BASE_PATH}

COPY calm-studio/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/calm-studio/apps/studio/build /tmp/studio-build
# Root install stays at /. A base path such as /studio is copied under that prefix
# so asset URLs baked by SvelteKit resolve on the Hub gateway.
RUN set -eu; \
    if [ -n "$BASE_PATH" ] && [ "$BASE_PATH" != "/" ]; then \
      prefix="$BASE_PATH"; \
      case "$prefix" in */) prefix="${prefix%/}";; esac; \
      mkdir -p "/usr/share/nginx/html${prefix}"; \
      cp -a /tmp/studio-build/. "/usr/share/nginx/html${prefix}/"; \
    else \
      cp -a /tmp/studio-build/. /usr/share/nginx/html/; \
    fi; \
    rm -rf /tmp/studio-build

EXPOSE 80
# /studio/ is the Hub gateway layout. / is the standalone image.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD sh -c "wget -qO- http://127.0.0.1/studio/ >/dev/null || wget -qO- http://127.0.0.1/ >/dev/null"
