import { describe, it, expect, afterEach } from 'vitest';
import { startServer } from './server';
import { SchemaDirectory } from '@finos/calm-shared';
import fetch from 'node-fetch';
import { Server } from 'http';
import { vi } from 'vitest';

describe('startServer', () => {
    let serverInstance: Server;
    const port = '3001';
    const host = '127.0.0.1';
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
        serverInstance = startServer(port, host, schemaDirectory, false, 900000, 100);

        // Wait for server to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        const response = await fetch(`http://${host}:${port}/health`);
        expect(response.status).toBe(200);
        const data = (await response.json()) as { status: string };
        expect(data.status).toBe('OK');
    });
});
