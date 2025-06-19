# Default node version if no ARG is provided
ARG NODE_VERSION="20"

FROM node:${NODE_VERSION}-alpine AS base

FROM base AS deps

# Copy necessary files for tests
COPY .env* ./
COPY playwright.config.* ./
COPY tests ./tests/
COPY package.json ./

RUN yarn install --frozen-lockfile

# Install Playwright browsers
RUN yarn run playwright install

CMD ["sh", "-c", "yarn run test:run"]