FROM node:24.18.0-slim AS build

WORKDIR /app
COPY package.json ./package.json
COPY agent/package.json agent/package-lock.json ./agent/
RUN npm ci --prefix agent

COPY agent ./agent
COPY lib/contextops/authority.ts ./lib/contextops/authority.ts
COPY lib/contextops/execution.ts ./lib/contextops/execution.ts
COPY lib/contextops/generated/portfolio.json ./lib/contextops/generated/portfolio.json
COPY fixtures/verge-demo-pack/data ./fixtures/verge-demo-pack/data

RUN npm run build --prefix agent \
  && npm prune --omit=dev --prefix agent

FROM node:24.18.0-slim AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    CONTEXTOPS_STATE_BACKEND=memory \
    CONTEXTOPS_TELEMETRY=console

WORKDIR /app
COPY --from=build /app/agent ./agent
COPY --from=build /app/lib ./lib
COPY --from=build /app/fixtures ./fixtures

WORKDIR /app/agent
EXPOSE 8080
CMD ["node", "dist/agent/src/server.js"]
