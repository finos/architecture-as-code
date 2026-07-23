// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const production = process.argv.includes('--production');
const __dirname = dirname(fileURLToPath(import.meta.url));

// Bundle 1: VS Code extension host entry point
await esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',           // REQUIRED — VS Code extension host requires CJS
  platform: 'node',
  target: 'node18',
  outfile: 'dist/extension.js',
  external: ['vscode'],    // REQUIRED — vscode module is provided by VS Code at runtime
  sourcemap: !production,
  minify: production,
});

// Bundle 2: MCP server entry point (bundled for stdio transport inside the extension)
// elkjs-svg uses native canvas bindings that cannot be bundled — mark it external
// and copy the module into dist/mcp-server/node_modules/ for runtime resolution.
const mcpServerSrc = resolve(__dirname, '../mcp-server/src/index.ts');

await esbuild.build({
  entryPoints: [mcpServerSrc],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: 'dist/mcp-server/index.js',
  external: ['elkjs-svg'],   // Native bindings — cannot bundle (RESEARCH Pitfall 3)
  sourcemap: false,
  minify: production,
});

// Copy elkjs-svg into dist/mcp-server/node_modules so Node can resolve it at runtime.
// elkjs-svg is marked external above (native canvas bindings cannot be bundled).
// We resolve it from the pnpm workspace store relative to the mcp-server package.
try {
  const { readdirSync, statSync } = await import('fs');
  const mcpServerPkg = resolve(__dirname, '../mcp-server');
  // Try multiple resolution paths (pnpm hoists to workspace root or mcp-server local)
  const searchPaths = [
    resolve(mcpServerPkg, 'node_modules/elkjs-svg'),
    resolve(__dirname, '../../node_modules/.pnpm/elkjs-svg@0.2.1/node_modules/elkjs-svg'),
    resolve(__dirname, '../../node_modules/elkjs-svg'),
  ];

  let elkjsPkgRoot = null;
  for (const p of searchPaths) {
    try {
      statSync(p);
      elkjsPkgRoot = p;
      break;
    } catch { /* not found at this path */ }
  }

  if (elkjsPkgRoot) {
    const destDir = resolve(__dirname, 'dist/mcp-server/node_modules/elkjs-svg');
    mkdirSync(destDir, { recursive: true });
    for (const file of readdirSync(elkjsPkgRoot)) {
      const src = resolve(elkjsPkgRoot, file);
      const dest = resolve(destDir, file);
      if (statSync(src).isFile()) {
        copyFileSync(src, dest);
      }
    }
    console.log('[esbuild] Copied elkjs-svg to dist/mcp-server/node_modules/elkjs-svg');
  } else {
    console.warn('[esbuild] elkjs-svg not found — MCP server SVG rendering may fail at runtime');
  }
} catch (e) {
  console.warn('[esbuild] Could not copy elkjs-svg:', e.message);
}
