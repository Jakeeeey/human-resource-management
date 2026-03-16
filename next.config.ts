import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
