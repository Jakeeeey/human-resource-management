import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // allowedDevOrigins: ['msi-4'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '100.110.197.61',
        port: '8056',
        pathname: '/uploads/**',
      },
    ],
  },
};

export default nextConfig;
