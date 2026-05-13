# Stage 1: build
FROM node:20-alpine AS builder
ARG APP_NAME
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm ci
COPY --chown=node:node . .
RUN npx nest build ${APP_NAME}

# Stage 2: run
FROM node:20-alpine
ARG APP_NAME
ENV APP_NAME=${APP_NAME}
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node --from=builder /app/dist ./dist
USER node
CMD node dist/apps/${APP_NAME}/main
