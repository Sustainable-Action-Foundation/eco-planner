/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  compiler: {
    removeConsole: {
      exclude: ['info', 'error', 'warn']
    }
  },
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
  },
}

export default nextConfig