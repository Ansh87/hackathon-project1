/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.86.24', '10.250.12.134:8080', 'https://hackathon-project1-production-9a51.up.railway.app'],
  productionBrowserSourceMaps: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.output.filename = 'static/chunks/[name]-[contenthash:8].js';
      config.output.chunkFilename = 'static/chunks/[contenthash:16].js';
    }
    return config;
  },
};

module.exports = nextConfig;
