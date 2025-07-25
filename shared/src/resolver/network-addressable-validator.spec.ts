import {
    extractNetworkAddressables,
    AddressableEntry,
} from './network-addressable-extractor.js';
import {
    NetworkAddressableValidator,
    ValidationResult,
} from './network-addressable-validator.js';
import { InMemoryResolver } from './calm-reference-resolver.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';

// Polyfill __dirname in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockData: Record<string, unknown> = {
    'https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json':
        {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: 'https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json',
            properties: {},
            type: 'object',
        },
    'https://calm.finos.org/workshop/controls/permitted-connection.requirement.json':
        {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: 'https://calm.finos.org/workshop/controls/permitted-connection.requirement.json',
            properties: {},
            enum: [],
        },
    // Config implementations: only $schema
    'https://calm.finos.org/workshop/controls/micro-segmentation.config.json': {
        $schema:
            'https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json',
    },
    'https://calm.finos.org/workshop/controls/permitted-connection-http.config.json':
        {
            $schema:
                'https://calm.finos.org/workshop/controls/permitted-connection.requirement.json',
        },
    'https://calm.finos.org/workshop/controls/permitted-connection-jdbc.config.json':
        {
            $schema:
                'https://calm.finos.org/workshop/controls/permitted-connection.requirement.json',
        },
};

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
const unreachableEntry: AddressableEntry = {
    key: 'unreachable-url',
    value: 'https://calm.finos.org/amazing-website',
    path: 'https://calm.finos.org/amazing-website',
};
entries.push(unreachableEntry);

describe('NetworkAddressableValidator E2E with InMemoryResolver', () => {
    const resolver = new InMemoryResolver(mockData);
    const validator = new NetworkAddressableValidator(resolver);
    let results: ValidationResult[];

    beforeAll(async () => {
        results = await validator.validate(entries);
    });

    it('control requirement URLs identified as schema definitions', () => {
        entries
            .filter((e) => e.key === 'requirement-url')
            .forEach((e) => {
                const r = results.find((r) => r.entry === e)!;
                expect(r.reachable).toBe(true);
                expect(r.isSchemaDefinition).toBe(true);
                expect(r.isSchemaImplementation).toBe(false);
            });
    });

    it('control config URLs identified as schema implementations', () => {
        entries
            .filter((e) => e.key === 'config-url')
            .forEach((e) => {
                const r = results.find((r) => r.entry === e)!;
                expect(r.reachable).toBe(true);
                expect(r.isSchemaDefinition).toBe(false);
                expect(r.isSchemaImplementation).toBe(true);
            });
    });

    it('unreachable URLs flagged correctly', () => {
        const result = results.find((r) => r.entry === unreachableEntry)!;
        expect(result.reachable).toBe(false);
        expect(result.isSchemaDefinition).toBe(false);
        expect(result.isSchemaImplementation).toBe(false);
        expect(result.error).toBe('Cannot resolve URL');
    });
});
