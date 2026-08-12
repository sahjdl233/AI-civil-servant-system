import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedHosts: ['.monkeycode-ai.live'],
  // 将前端的 /api/* 透明代理到后端 FastAPI
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8001/api/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8001',
        pathname: '/api/v1/questions/images/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/api/v1/questions/images/**',
      },
    ],
  },
};

export default nextConfig;
