# The ea-layers extension service of CALM Hub. Build it from the repository root, which holds the lockfile:
#   docker build -f calm-hub-extensions/ea-layers/Dockerfile -t finos/calm-hub-ea-layers .
FROM node:26-alpine AS build

WORKDIR /src
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY calm-hub-extensions/ea-layers/ calm-hub-extensions/ea-layers/
# Only this workspace: npm ci accepts the root lockfile without the folders of the others.
RUN npm ci --workspace calm-hub-extensions/ea-layers --include-workspace-root=false --ignore-scripts \
    && npm run build --workspace calm-hub-extensions/ea-layers

FROM node:26-alpine

WORKDIR /opt/calm-hub-ea-layers
COPY --from=build /src/calm-hub-extensions/ea-layers/extension.json /src/calm-hub-extensions/ea-layers/notation.json ./
COPY --from=build /src/calm-hub-extensions/ea-layers/dist/ dist/

# The service copies extension.json and notation.json here at each start, for a Hub that reads this folder from a
# shared volume. A new named volume takes the owner of this folder.
RUN mkdir /extensions && chown node:node /extensions

USER node
ENV HOST=0.0.0.0 PORT=8094
EXPOSE 8094
HEALTHCHECK --interval=5s --timeout=3s --retries=12 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "dist/main.js"]
