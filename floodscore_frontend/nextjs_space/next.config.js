/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['192.168.86.24', '10.250.12.134:8080', 'https://hackathon-project1-production-9a51.up.railway.app'],
  productionBrowserSourceMaps: false,
  turbopack: {},
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
