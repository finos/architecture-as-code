import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { startServer } from './cli-server';
import { SchemaDirectory } from '@finos/calm-shared';

function getAvailablePort() {
  // Use 0 to let the OS assign an available port
  return String(0);
}

describe('startServer (integration)', () => {
  it('should start the server, respond to /health, and shut down', async () => {
    const schemaDirectory = {} as SchemaDirectory;
    const port = getAvailablePort();
    const serverInstance = startServer(port, schemaDirectory, false);
    // Wait for server to be ready
    await new Promise(res => setTimeout(res, 100));
    const address = serverInstance.address();
    // Type guard for address
    if (!address || typeof address === 'string') {
      throw new Error('Server did not start with a valid address');
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const agent = request(baseUrl);
    const response = await agent.get('/health').timeout({ deadline: 3000 });
    expect(response.status).toBe(200);
    serverInstance.close();
  }, 3000);
});
