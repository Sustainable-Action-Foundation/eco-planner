# syntax=docker/dockerfile:1
# Production-optimized Dockerfile for Next.js application

# Build arguments
ARG NODE_VERSION="24"

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


# Set working directory
WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./

# Enable corepack for modern package manager support
RUN corepack enable

# Create non-root user for security (no shell)
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 --shell /bin/false nextjs


# ============================================================================
# Dependencies stage - Install and cache dependencies
# ============================================================================
FROM base AS deps

# Install dependencies (GHA cache handled by buildx)
RUN yarn install --immutable

# Clean up temporary files to reduce image size
RUN rm -rf /tmp/* /var/tmp/*


# ============================================================================
# Prisma stage - Generate Prisma client
# ============================================================================
FROM deps AS prisma

COPY prisma/ ./prisma/
RUN yarn prisma generate


# ============================================================================
# Builder stage - Build the application
# ============================================================================
FROM base AS builder

ARG COMMIT_SHA

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
# Copy yarn from corepack cache, to avoid downloading it again
COPY --from=deps /root/.cache/node/corepack /root/.cache/node/corepack

# Copy source code (using .dockerignore)
COPY . .

# Copy Prisma clients generated files from the prisma stage
COPY --from=prisma /app/.prisma/generated/ ./.prisma/generated/

# Set build environment variables
ENV NODE_ENV=production
# Next.js collects completely anonymous telemetry data about general usage. Learn more here: https://nextjs.org/telemetry
ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=true
ENV COMMIT_SHA=${COMMIT_SHA}

# Force Next config re-evaluation per commit without busting deps.
RUN printf "// BUILD_COMMIT: %s\n" "${COMMIT_SHA}" >> next.config.ts

# Build with cache mount for Next.js
RUN --mount=type=cache,target=/app/.next/cache \
  yarn run build


# ============================================================================
# Production runtime stage
# ============================================================================
FROM base AS runner

ARG COMMIT_SHA

# Build arguments for git information (for debugging/monitoring)
ENV COMMIT_SHA=${COMMIT_SHA}

# Set production environment variables
ENV NODE_ENV=production
# Next.js collects completely anonymous telemetry data about general usage. Learn more here: https://nextjs.org/telemetry
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8081
ENV HOSTNAME=0.0.0.0

# Copy public assets
COPY --from=builder /app/public ./public

# Copy built application with proper ownership
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ensure proper permissions
RUN mkdir -p .next && chown -R nextjs:nodejs .next

# App has an API endpoint which always returns 200 OK
HEALTHCHECK --interval=3s --timeout=10s --start-period=3s --retries=10 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Switch to non-root user for security
USER nextjs

# Expose the application port
EXPOSE ${PORT}

# Use dumb-init to handle signals properly in containers since node isn't built for it
ENTRYPOINT ["dumb-init", "--"]

# Start the Next.js server
CMD ["node", "server.js"]