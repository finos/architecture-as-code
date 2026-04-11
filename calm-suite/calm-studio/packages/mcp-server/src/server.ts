// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerArchitectureTools } from './tools/architecture.js';
import { registerNodeTools } from './tools/nodes.js';
import { registerRelationshipTools } from './tools/relationships.js';
import { registerIOTools } from './tools/io.js';
import { registerRenderTools } from './tools/render.js';
import { registerGuideTools } from './tools/guide.js';
import { registerViewTools } from './tools/view.js';

/**
 * Create and configure the CalmStudio MCP server with all tool registrations.
 */
export function createServer(): McpServer {
  const server = new McpServer({ name: 'calmstudio', version: '1.0.0' });

  registerArchitectureTools(server);
  registerNodeTools(server);
  registerRelationshipTools(server);
  registerIOTools(server);
  registerRenderTools(server);
  registerGuideTools(server);
  registerViewTools(server);

  return server;
}
