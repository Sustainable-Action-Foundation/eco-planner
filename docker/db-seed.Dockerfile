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
# Yarn patches are part of dependency resolution (patch: protocol)
COPY .yarn/patches/ ./.yarn/patches/
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

# Everything is owned by the non-root user since seeding writes back into the
# app dir (prisma migrate reset re-runs generate into prisma/generated/)
# Various files used by the seeding script
COPY --chown=node:node scripts/lib ./scripts/lib
COPY --chown=node:node scripts/prisma ./scripts/prisma
COPY --chown=node:node src/functions ./src/functions
COPY --chown=node:node src/lib ./src/lib
COPY --chown=node:node src/types ./src/types
COPY --chown=node:node src/math.ts ./src/math.ts

# Dependencies
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

# Prisma schema and config files and generated
COPY --from=prisma --chown=node:node /app/prisma/ ./prisma/
COPY --chown=node:node prisma.config.ts tsconfig.json ./

# Yarn rewrites .yarn/install-state.gz at runtime, so the app dirs created by
# root stages must be handed over too (non-recursive; contents are copied --chown)
RUN chown node:node /app /app/.yarn /app/.yarn/patches

# Run as the node user shipped with the base image; yarn is prepared under
# this user so its corepack cache is usable at runtime
USER node
RUN corepack prepare --activate

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "yarn prisma migrate reset --force && yarn prisma db seed"]