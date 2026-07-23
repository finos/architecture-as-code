#!/usr/bin/env node
// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { createServer } from './server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const PKG_VERSION = '0.0.0';

const HELP = `
calmstudio-mcp — CalmStudio MCP server

Usage:
  calmstudio-mcp [options]

Options:
  --http        Start HTTP transport instead of stdio (default: stdio)
  --port <N>    Port for HTTP mode (default: 3100)
  --version     Print version and exit
  --help        Print this help and exit

Examples:
  calmstudio-mcp                   # stdio mode (for Claude Code / MCP clients)
  calmstudio-mcp --http            # HTTP mode on port 3100
  calmstudio-mcp --http --port 4000
`.trim();

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes('--version')) {
  process.stdout.write(`${PKG_VERSION}\n`);
  process.exit(0);
}

if (args.includes('--help')) {
  process.stdout.write(`${HELP}\n`);
  process.exit(0);
}

const useHttp = args.includes('--http');
const portIdx = args.indexOf('--port');
const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1]!, 10) : 3100;

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const server = createServer();

  if (useHttp) {
    // Dynamic import to avoid loading HTTP modules in stdio mode
    const { createServer: createHttpServer } = await import('node:http');
    const { StreamableHTTPServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/streamableHttp.js'
    );

    const httpServer = createHttpServer(async (req, res) => {
      // Stateless mode: no sessionIdGenerator (omitted)
      const transport = new StreamableHTTPServerTransport();
      // Type cast required: SDK's exactOptionalPropertyTypes conflict with internal Transport interface
      await server.connect(transport as unknown as import('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport);
      await transport.handleRequest(req, res, await readBody(req));
    });

    httpServer.listen(port, () => {
      console.error(`[calmstudio-mcp] HTTP server listening on port ${port}`);
    });
  } else {
    // Default: stdio transport (Claude Code / MCP client compatible)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // CRITICAL: No console.log after connect — stdout is owned by MCP protocol
    // Use console.error for any diagnostic output
  }
}

function readBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(body ? (JSON.parse(body) as unknown) : undefined);
      } catch {
        resolve(undefined);
      }
    });
    req.on('error', reject);
  });
}

main().catch((err) => {
  console.error('[calmstudio-mcp] Fatal error:', err);
  process.exit(1);
});
