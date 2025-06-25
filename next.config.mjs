/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
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
    { _buildId, _dev, _isServer, _defaultLoaders, _nextRuntime, _webpack }
  ) => {

    // Ignore "src/scripts" folder in the build process
    config.module.rules.push({
      test: /src\/scripts/,
      use: 'ignore-loader',
    })

    return config;
  },
  turbopack: {
    rules: {
      "/src/scripts/": {
        loaders: ['ignore-loader'],
      }
    },
  }
}

export default nextConfig