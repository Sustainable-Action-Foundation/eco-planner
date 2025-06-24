# syntax=docker/dockerfile:1
# Dockerfile for Prisma database seeding

# Build arguments
ARG NODE_VERSION="20"

FROM node:${NODE_VERSION}-alpine AS base

# Install security updates and essential packages
RUN apk update && apk upgrade && \
  apk add --no-cache \
  libc6-compat \
  curl \
  && rm -rf /var/cache/apk/*

# Enable corepack for modern package manager support
RUN corepack enable

# Set working directory
WORKDIR /app

COPY package.json yarn.lock* ./
COPY prisma/ ./prisma/

RUN yarn install --frozen-lockfile
RUN yarn prisma generate

CMD ["sh", "-c", "yarn prisma migrate reset --force"]