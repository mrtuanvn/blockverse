import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Vercel deployment optimizations
  images: {
    unoptimized: true,
  },
  // Allow cross-origin for preview
  allowedDevOrigins: ['*'],
  // Webpack config for WASM support (needed for Rapier physics)
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
};

export default nextConfig;