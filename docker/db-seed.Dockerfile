# syntax=docker/dockerfile:1
# Dockerfile for Prisma database seeding

# Build arguments
ARG NODE_VERSION="20"


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

# Enable corepack for modern package manager support
RUN corepack enable

WORKDIR /app

# =============================================================================
# Dependencies stage - Install and cache dependencies
# =============================================================================
FROM base as deps

COPY package.json yarn.lock* ./

# Install dependencies (GHA cache handled by buildx)
RUN yarn install --frozen-lockfile

# Clean up temporary files to reduce image size
RUN rm -rf /tmp/* /var/tmp/*


# =============================================================================
# Prisma stage - Generate Prisma client
# =============================================================================
FROM deps as prisma

COPY prisma/ ./prisma/
RUN yarn prisma generate


# =============================================================================
# Seed stage - Run database seeding
# =============================================================================
FROM prisma as seed

# Seeding script uses some general script lib files
COPY src/scripts/lib ./src/scripts/lib

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "yarn prisma migrate reset --force"]