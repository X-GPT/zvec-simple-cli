# Dev stage: run tests with vitest
FROM node:22-slim AS dev
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

# Build stage: compile TypeScript
FROM dev AS build
RUN npm run build && npm pack

# Prod stage: install as global CLI
FROM node:22-slim AS prod
COPY --from=build /app/*.tgz /tmp/
RUN npm install -g /tmp/*.tgz && rm /tmp/*.tgz
ENTRYPOINT ["zdoc"]
