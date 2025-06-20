# Default node version if no ARG is provided
ARG NODE_VERSION="20"

FROM node:${NODE_VERSION}-alpine AS base

FROM base AS deps
WORKDIR /app

# Copy necessary files for tests
COPY .env* ./
COPY playwright.config.* ./
COPY tests ./tests/
COPY package.json ./
COPY yarn.lock ./

RUN yarn install --frozen-lockfile

# Install Playwright browsers
RUN yarn run playwright install

# Create test-results directory
RUN mkdir -p test-results

CMD ["sh", "-c", "yarn run test:run --reporter=json > ./test-results/results.json 2>&1 || exit $?"]