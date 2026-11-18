# The C4 extension service of CALM Hub. Build it from the repository root, which holds the lockfile:
#   docker build -f calm-hub-extensions/c4/Dockerfile -t finos/calm-hub-c4 .
FROM node:26-alpine AS build

WORKDIR /src
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY calm-models/ calm-models/
COPY calm-hub-extensions/c4/ calm-hub-extensions/c4/
# Only the two workspaces: npm ci accepts the root lockfile without the folders of the others.
RUN npm ci --workspace calm-models --workspace calm-hub-extensions/c4 --include-workspace-root=false --ignore-scripts \
    && npm run build --workspace calm-models \
    && npm run build --workspace calm-hub-extensions/c4

FROM node:26-alpine

WORKDIR /opt/calm-hub-c4
COPY --from=build /src/calm-hub-extensions/c4/extension.json /src/calm-hub-extensions/c4/notation.json ./
# dist/main.js has calm-models in it, so the image needs no node_modules.
COPY --from=build /src/calm-hub-extensions/c4/dist/ dist/

# The service copies extension.json and notation.json here at each start, for a Hub that reads this folder from a
# shared volume. A new named volume takes the owner of this folder.
RUN mkdir /extensions && chown node:node /extensions

USER node
ENV HOST=0.0.0.0 PORT=8093
EXPOSE 8093
HEALTHCHECK --interval=5s --timeout=3s --retries=12 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "dist/main.js"]
