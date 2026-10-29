# K53ExamApp — production image (Neon DB, no local postgres)
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Bundle directly; image builds never touch database schema.
RUN npx tsx script/build.ts

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# server/static.ts serves dist/public, bundled server is dist/index.cjs
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
