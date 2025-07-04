# syntax=docker/dockerfile:1
# Dockerfile for playwright testing environment

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

WORKDIR /testing


# =============================================================================
# Dependencies stage - Install and cache dependencies
# =============================================================================
FROM base AS deps

# Copy package manager files for dependency installation
COPY package.json yarn.lock* ./

# Install dependencies (GHA cache handled by buildx)
RUN yarn install --frozen-lockfile

# Clean up temporary files to reduce image size
RUN rm -rf /tmp/* /var/tmp/*


# =============================================================================
# Playwright stage - Install Playwright and its browsers
# =============================================================================
FROM deps AS playwright

# Install Playwright and its dependencies
RUN apk add --no-cache \
  chromium \
  firefox \
  && yarn playwright install

# Clean up unnecessary browser caches
RUN rm -rf \
  /tmp/* \
  /var/tmp/*


# =============================================================================
# Runner stage - Final testing environment
# =============================================================================
FROM playwright AS runner

# Copy dependencies from previous stages
# COPY --from=playwright /root/.cache/ms-playwright /root/.cache/ms-playwright
# COPY --from=deps /testing/node_modules ./node_modules

# Copy only necessary files first (better layer caching)
COPY package.json yarn.lock* ./
COPY playwright.config.* ./

# Copy source code last (changes most frequently)
COPY . .

# Set environment variables for testing
ENV LOGIN_USERNAME=admin
ENV LOGIN_PASSWORD=admin
ENV CI=true

# Set the entrypoint for testing
ENTRYPOINT ["dumb-init", "yarn", "test:run", "-v"]