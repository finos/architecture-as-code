import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Exclude @finos/calm-cli from webpack bundling — it's a Node.js CLI tool
  // invoked as a subprocess at runtime, not imported directly.
  serverExternalPackages: ['@finos/calm-cli'],
  // Pin Next's workspace-root inference to the monorepo root. After the A3
  // calm-suite/calm-guard → calm-guard move, the workspace is 1 level deep
  // instead of 2, and Next's auto-detection (which also picks up stray
  // pnpm-lock.yaml files in $HOME during local dev) emits the wrong relative
  // prefix for `node_modules/next/...` resolutions. Anchoring to the monorepo
  // root via `outputFileTracingRoot` makes the path computation deterministic.
  outputFileTracingRoot: path.join(__dirname, '..'),
};

export default nextConfig;
