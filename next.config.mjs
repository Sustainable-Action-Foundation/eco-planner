/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  ...(process.env.NODE_ENV == "production" ? {
    compiler: {
      removeConsole: {
        exclude: ['info', 'error', 'warn']
      },
    }
  } : {}),
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
  },
  webpack: (
    config,
    { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }
  ) => {

    // Ignore "src/scripts" folder in the build process
    config.module.rules.push({
      test: /src\/scripts/,
      use: 'ignore-loader',
    })

    return config;
  },
}

export default nextConfig