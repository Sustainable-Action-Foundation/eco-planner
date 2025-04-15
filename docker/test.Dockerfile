FROM node:20-bookworm AS base

FROM base AS deps

WORKDIR /app

# Copy package files
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# Install dependencies
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Copy necessary files for tests
COPY .env* ./
COPY playwright.config.* ./
COPY tests ./tests/

# Install Playwright browsers
RUN yarn playwright install --with-deps

# Default command to run tests
CMD ["yarn", "test:ci"]