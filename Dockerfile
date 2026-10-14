# syntax=docker/dockerfile:1

############################
# 构建阶段：编译前后端
############################
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY server/package.json server/package-lock.json* ./server/
COPY web/package.json web/package-lock.json* ./web/
RUN npm --prefix server install --no-audit --no-fund \
 && npm --prefix web install --no-audit --no-fund

COPY server ./server
COPY web ./web

RUN npm --prefix web run build \
 && npm --prefix server run build \
 && npm --prefix server prune --omit=dev

############################
# 运行阶段：精简镜像
############################
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data \
    SEED_ON_EMPTY=true \
    ENABLE_LIVE_SIMULATOR=true \
    LOG_LEVEL=info
WORKDIR /app

COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist

RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
