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
}

export default nextConfig