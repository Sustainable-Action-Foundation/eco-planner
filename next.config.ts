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
  experimental: {
    useCache: true,
  }
}

export default nextConfig