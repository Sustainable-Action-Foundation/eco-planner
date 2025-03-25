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
}

export default nextConfig