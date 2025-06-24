# syntax=docker/dockerfile:1
# Production-optimized Dockerfile for Next.js application

# Build arguments
ARG NODE_VERSION="20"

# ============================================================================
# Base stage - Common dependencies and setup
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS base

# Install security updates and essential packages
RUN apk update && apk upgrade && \
  apk add --no-cache \
  libc6-compat \
  dumb-init \
  curl \
  && rm -rf /var/cache/apk/*

# Enable corepack for modern package manager support
RUN corepack enable

# Set working directory
WORKDIR /app

COPY package.json yarn.lock* ./
COPY prisma/schema.prisma ./prisma/

RUN yarn install --frozen-lockfile
RUN yarn prisma generate

CMD ["dumb-init", "yarn", "prisma", "db", "seed"]