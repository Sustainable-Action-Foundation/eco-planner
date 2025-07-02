# syntax=docker/dockerfile:1
# Dockerfile for Prisma database seeding

# Build arguments
ARG NODE_VERSION="22"


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

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.yarn \
  yarn install --frozen-lockfile


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

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "yarn prisma migrate reset --force"]