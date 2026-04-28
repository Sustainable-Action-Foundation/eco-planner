# syntax=docker/dockerfile:1
# Dockerfile for Prisma database seeding

# Build arguments
ARG NODE_VERSION="24"


# =============================================================================
# Base stage - Common dependencies and setup
# =============================================================================
FROM node:${NODE_VERSION}-alpine AS base

# Install security updates and essential packages
RUN apk update && apk upgrade && \
  apk add --no-cache \
  libc6-compat \
  dumb-init \
  && rm -rf /var/cache/apk/*

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
# Enable corepack for modern package manager support
RUN corepack enable
# Preinstall yarn to ensure it's available for seeding stage
RUN corepack prepare --activate


# =============================================================================
# Dependencies stage - Install and cache dependencies
# =============================================================================
FROM base AS deps

# Install dependencies (GHA cache handled by buildx)
RUN yarn install --immutable

# Clean up temporary files to reduce image size
RUN rm -rf /tmp/* /var/tmp/*


# =============================================================================
# Prisma stage - Generate Prisma client
# =============================================================================
FROM base AS prisma

# Dependencies
COPY --from=deps /app/node_modules ./node_modules

# Prisma schema and config files
COPY prisma/ ./prisma/
COPY prisma.config.ts tsconfig.json ./

RUN yarn prisma generate


# =============================================================================
# Seed stage - Run database seeding
# =============================================================================
FROM base AS seed

# Various files used by the seeding script
COPY scripts/lib ./scripts/lib
COPY scripts/prisma ./scripts/prisma
COPY src/functions ./src/functions
COPY src/lib ./src/lib
COPY src/types ./src/types
COPY src/math.ts ./src/math.ts

# Dependencies
COPY --from=deps /app/node_modules ./node_modules

# Prisma client and generated files
COPY --from=prisma /app/.prisma ./.prisma

# Prisma schema and config files
COPY prisma/ ./prisma/
COPY prisma.config.ts tsconfig.json ./

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "yarn prisma migrate reset --force --skip-generate && yarn prisma db seed"]