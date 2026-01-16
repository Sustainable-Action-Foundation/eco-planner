import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: 'bottom-right'
  },
  ...(process.env.NODE_ENV == "production" ? {
    compiler: {
      removeConsole: {
        exclude: ['info', 'error', 'warn']
      },
    }
  } : {}),
  output: process.env.CI ? 'standalone' : undefined,
  webpack: (
    config,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }
  ) => {

    // Ignore "src/scripts" folder in the build process
    config.module.rules.push({
      test: /src\/scripts/,
      use: 'ignore-loader',
    });

    return config;
  },
  turbopack: {
    rules: {
      "/src/scripts/": {
        loaders: ['ignore-loader'],
      },
    },
  },
  experimental: {
    useCache: true,
  }
}

export default nextConfig