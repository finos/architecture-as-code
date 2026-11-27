import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    extractNetworkAddressables,
    AddressableEntry,
} from './network-addressable-extractor.js';
import {
    NetworkAddressableValidator,
    ValidationResult,
} from './network-addressable-validator.js';
import { calmSite } from '../test/mocks/calm-site.js';

const WORKSHOP_DIR = join(
    __dirname,
    '../../../conferences/osff-ln-2025/workshop'
);
const jsonPath = join(
    WORKSHOP_DIR,
    'architecture/conference-secure-signup-amended.arch.json'
);
const jsonDoc = readFileSync(jsonPath, 'utf-8');
const entries: AddressableEntry[] = extractNetworkAddressables(jsonDoc);

// The default HttpReferenceResolver sends real requests, and calmSite answers them.
const site = calmSite();
const validator = new NetworkAddressableValidator();

describe('NetworkAddressableValidator E2E', () => {
    let results: ValidationResult[];

    beforeAll(async () => {
        site.listen({ onUnhandledRequest: 'error' });
        results = await validator.validate(entries);
    });

    afterAll(() => site.close());

    it('validates the conference website URL as reachable and not a schema', () => {
        const entry = entries.find(
            (e) => e.value === 'https://calm.finos.org/amazing-website'
        );
        const result = results.find((r) => r.entry === entry);
        expect(result).toBeDefined();
        expect(result?.reachable).toBe(false);
        expect(result?.isSchemaDefinition).toBe(false);
        expect(result?.isSchemaImplementation).toBe(false);
        expect(result?.error).toBe(
            'HTTP request failed for https://calm.finos.org/amazing-website: Failed to load document from URL: https://calm.finos.org/amazing-website: Request failed with status code 404'
        );
    });

    it('validates a control-requirement URL as schema document', () => {
        const entry = entries.find((e) => e.key === 'requirement-url');
        const result = results.find((r) => r.entry === entry);
        expect(result).toBeDefined();
        expect(result?.reachable).toBe(true);
        expect(result?.isSchemaDefinition).toBe(true);
        expect(result?.isSchemaImplementation).toBe(false);
    });

    it('validates a control-config URL as schema document', () => {
        const entry = entries.find((e) => e.key === 'config-url');
        const result = results.find((r) => r.entry === entry);
        expect(result).toBeDefined();
        expect(result?.reachable).toBe(true);
        expect(result?.isSchemaDefinition).toBe(false);
        expect(result?.isSchemaImplementation).toBe(true);
    });

    it('all entries have a reachable or error result', () => {
        expect(results.length).toBe(entries.length);
        results.forEach((r) => {
            expect(r.reachable || r.error).toBeDefined();
        });
    });
});
