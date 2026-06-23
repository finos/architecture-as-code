import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Exclude @finos/calm-cli from webpack bundling — it's a Node.js CLI tool
  // invoked as a subprocess at runtime, not imported directly.
  serverExternalPackages: ['@finos/calm-cli'],
};

export default nextConfig;
