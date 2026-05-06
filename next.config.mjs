/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.impact.com' },
      { protocol: 'https', hostname: '**.buybestgear.com' },
      { protocol: 'https', hostname: '**' }
    ],
    minimumCacheTTL: 86400,
  },
  experimental: {
    serverComponentsExternalPackages: ['@neondatabase/serverless']
  }
}

export default nextConfig
