import { describe, it, expect, afterAll } from 'vitest';
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

    const DOCUMENT_ID = 'https://h/calm/namespaces/ns/architectures/my-service/versions/1.0.0';

    it('creates a file named by the slug and returns its path', async () => {
        const filePath = await createNewDocument(DOCUMENT_ID, 'My Service', 'architecture', 'my-service');
        createdFiles.push(filePath);

        expect(existsSync(filePath)).toBe(true);
        expect(path.basename(filePath)).toBe('my-service.architecture.json');
    });

    it('renders the template with the document $id and title', async () => {
        const filePath = await createNewDocument(DOCUMENT_ID, 'My Arch', 'architecture', 'my-arch', 'empty');
        createdFiles.push(filePath);

        const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
        expect(parsed.$id).toBe(DOCUMENT_ID);
        expect(parsed.title).toBe('My Arch');
    });

    it('creates files for different types', async () => {
        for (const type of ['architecture', 'pattern']) {
            const filePath = await createNewDocument(DOCUMENT_ID, `Test ${type}`, type, `test-${type}`);
            createdFiles.push(filePath);
            expect(existsSync(filePath)).toBe(true);
            expect(filePath).toContain(`.${type}.json`);
        }
    });
});
