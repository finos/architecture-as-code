import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startServer } from './cli-server';
import { SchemaDirectory } from '@finos/calm-shared';
import fetch from 'node-fetch';
import { Server } from 'http';
import { vi } from 'vitest';

describe('startServer', () => {
    let serverInstance: Server;
    const port = '3001';
    const schemaDirectory = {
        loadSchemas: vi.fn(),
        getSchema: vi.fn(),
    } as unknown as SchemaDirectory;

    afterEach(() => {
        if (serverInstance) {
            serverInstance.close();
        }
    });

    it('should start the server and respond to /health', async () => {
        serverInstance = startServer(port, schemaDirectory, false);

        // Wait for server to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        const response = await fetch(`http://localhost:${port}/health`);
        expect(response.status).toBe(200);
        const data = (await response.json()) as { status: string };
        expect(data.status).toBe('OK');
    });
});
