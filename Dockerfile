# K53ExamApp — production image (Neon DB, no local postgres)
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NOTE: skips `npm run build` on purpose — that runs `drizzle-kit push`
# against Neon on every build. Schema already exists; just bundle.
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
