# syntax=docker/dockerfile:1
# Dockerfile for playwright testing environment

# Build arguments
ARG NODE_VERSION="20"

# ============================================================================
# Base stage - Common dependencies and setup
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS base

# Install security updates and essential packages
RUN apk update && apk upgrade && \
  apk add --no-cache \
  dumb-init \
  && rm -rf /var/cache/apk/*

# Enable corepack for modern package manager support
RUN corepack enable

WORKDIR /testing

# ============================================================================
# Dependencies stage - Install and cache dependencies
# ============================================================================

FROM base AS deps

# Copy package manager files for dependency installation
COPY package.json yarn.lock* ./

# Install dependencies
RUN yarn install --frozen-lockfile
RUN yarn playwright install

# ============================================================================
# Runner stage - Prepare for testing
# ============================================================================

FROM base AS runner

# Copy dependencies from deps stage
COPY --from=deps /testing/node_modules ./node_modules

# Copy source code (has its own .dockerignore)
COPY . .

# Set   environment variables for testing
ENV LOGIN_USERNAME=admin
ENV LOGIN_PASSWORD=admin
ENV CI=true

# Set the entrypoint for testing
ENTRYPOINT ["dumb-init", "yarn", "test:run"]