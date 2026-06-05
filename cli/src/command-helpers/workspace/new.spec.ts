import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTemplatesForType, createNewDocument } from './new';
import { rm } from 'fs/promises';
import path from 'path';
import { existsSync, readFileSync } from 'fs';

describe('getTemplatesForType', () => {
    it('returns template names for a known type', async () => {
        const templates = await getTemplatesForType('architecture');
        expect(templates).toContain('empty');
        expect(templates.every(t => !t.endsWith('.hbs'))).toBe(true);
    });

    it('returns empty array for an unknown type', async () => {
        const templates = await getTemplatesForType('nonexistent-type-xyz');
        expect(templates).toEqual([]);
    });

    it('returns all template types found in the templates dir', async () => {
        const types = ['architecture', 'pattern', 'schema'];
        for (const type of types) {
            const templates = await getTemplatesForType(type);
            expect(Array.isArray(templates)).toBe(true);
        }
    });
});

describe('createNewDocument', () => {
    const createdFiles: string[] = [];

    afterAll(async () => {
        for (const f of createdFiles) {
            if (existsSync(f)) {
                await rm(f);
            }
        }
    });

    it('creates a file and returns its path', async () => {
        const filePath = await createNewDocument('com.example', 'my-service', 'architecture');
        createdFiles.push(filePath);

        expect(existsSync(filePath)).toBe(true);
        expect(path.basename(filePath)).toBe('my-service.architecture.json');
    });

    it('renders the template with name and id', async () => {
        const filePath = await createNewDocument('com.example', 'my-arch', 'architecture', 'empty');
        createdFiles.push(filePath);

        const content = readFileSync(filePath, 'utf8');
        expect(content.length).toBeGreaterThan(0);
    });

    it('creates files for different types', async () => {
        for (const type of ['architecture', 'pattern']) {
            const filePath = await createNewDocument('com.example', `test-${type}`, type);
            createdFiles.push(filePath);
            expect(existsSync(filePath)).toBe(true);
            expect(filePath).toContain(`.${type}.json`);
        }
    });
});
