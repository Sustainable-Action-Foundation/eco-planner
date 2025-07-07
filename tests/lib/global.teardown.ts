import type { FullConfig } from "playwright/test";

async function globalTeardown(config: FullConfig) {
  await new Promise((resolve) => {
    setTimeout(() => resolve(true), 500);
  });
}

export default globalTeardown;