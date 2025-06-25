# syntax=docker/dockerfile:1
# Dockerfile for Prisma database seeding

# Build arguments
ARG NODE_VERSION="22"

FROM node:${NODE_VERSION}-bookworm AS base

# Install security updates and essential packages
RUN apt-get update && apt-get upgrade -y && \
  apt-get install -y --no-install-recommends \
  dumb-init \
  && rm -rf /var/lib/apt/lists/*

# Enable corepack for modern package manager support
RUN corepack enable

# Set working directory
WORKDIR /app

COPY package.json yarn.lock* ./
COPY prisma/ ./prisma/

RUN yarn install --frozen-lockfile
RUN yarn prisma generate

CMD ["sh", "-c", "yarn prisma migrate reset --force"]