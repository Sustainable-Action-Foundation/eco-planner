# Default node version if no ARG is provided
ARG NODE_VERSION="20"

FROM node:${NODE_VERSION}-alpine AS base

FROM base AS deps

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Copy necessary files for tests
COPY .env* ./
COPY playwright.config.* ./
COPY tests ./tests/
COPY src ./src/
COPY public ./public/

# Install Playwright browsers
RUN yarn playwright install --with-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy files necessary to run `yarn prisma migrate reset` to reset and seed the database
# FOR DEVELOPMENT/TESTING/STAGING
COPY --from=deps /app/node_modules ./node_modules
COPY /prisma ./prisma
COPY package.json ./

USER nextjs

# Network config
EXPOSE 8081

ENV PORT=8081
ENV HOSTNAME=0.0.0.0

# Git commit info
ARG GIT_LONG_HASH
ENV GIT_LONG_HASH=$GIT_LONG_HASH

ARG GIT_SHORT_HASH
ENV GIT_SHORT_HASH=$GIT_SHORT_HASH

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]
