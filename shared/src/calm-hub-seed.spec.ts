import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { calmSchemaDir, TEST_ALL_SCHEMA } from './test/test-utils';

// CALM Hub does not validate the documents it seeds, so this test does.

const CALM_HUB_DIR = path.join(__dirname, '../../calm-hub');
const CALM_RELEASE_SCHEMA = 'https://calm.finos.org/release/';

type SeedDocument = { $schema: string; [key: string]: unknown };

function createAjv(): Ajv2020 {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    for (const [release] of TEST_ALL_SCHEMA) {
        const dir = calmSchemaDir(release);
        for (const file of readdirSync(dir).filter(name => name.endsWith('.json'))) {
            ajv.addSchema(JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
        }
    }
    return ajv;
}

function controlRequirements(): [string, SeedDocument][] {
    const controlsDir = path.join(CALM_HUB_DIR, 'mongo/controls');
    return readdirSync(controlsDir).flatMap(domain =>
        readdirSync(path.join(controlsDir, domain))
            .filter(file => file.endsWith('.json'))
            .flatMap(file => {
                const control = JSON.parse(readFileSync(path.join(controlsDir, domain, file), 'utf8'));
                return Object.entries<SeedDocument>(control.requirement ?? {})
                    .map(([version, doc]): [string, SeedDocument] => [`${domain}/${file} ${version}`, doc]);
            }));
}

// Index just past the brace that closes the object opened at start.
function objectEnd(source: string, start: number): number {
    let depth = 0;
    let inString = false;
    for (let i = start; i < source.length; i++) {
        const char = source[i];
        if (inString) {
            if (char === '\\') i++;
            else if (char === '"') inString = false;
        } else if (char === '"') {
            inString = true;
        } else if (char === '{') {
            depth++;
        } else if (char === '}' && --depth === 0) {
            return i + 1;
        }
    }
    throw new Error(`Unclosed object at offset ${start}`);
}

function parseJson(text: string): SeedDocument | undefined {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

// The seed scripts hold CALM documents as JSON literals that start with their $schema.
// A literal that is not JSON (a jq program that builds a document at seed time) is skipped.
function embeddedDocuments(file: string): [string, SeedDocument][] {
    const source = readFileSync(path.join(CALM_HUB_DIR, file), 'utf8');
    const marker = /"\$schema":\s*"https:\/\/calm\.finos\.org\/release\//g;
    return [...source.matchAll(marker)].flatMap((match): [string, SeedDocument][] => {
        const start = source.lastIndexOf('{', match.index);
        const doc = parseJson(source.slice(start, objectEnd(source, start)));
        const line = source.slice(0, match.index).split('\n').length;
        return doc ? [[`${file}:${line} ${doc['unique-id'] ?? ''}`.trim(), doc]] : [];
    });
}

// A pattern is itself a JSON Schema, so it is not an instance of the meta-schema it declares.
const isPattern = (doc: SeedDocument) => 'properties' in doc;

const seedDocuments: [string, SeedDocument][] = [
    ...controlRequirements(),
    ...embeddedDocuments('mongo/init-mongo.js'),
    ...embeddedDocuments('nitrite/init-nitrite.sh'),
].filter(([, doc]) => doc.$schema?.startsWith(CALM_RELEASE_SCHEMA) && !isPattern(doc));

describe('CALM Hub seed documents', () => {
    const ajv = createAjv();

    it('finds the seed documents', () => {
        expect(seedDocuments.length).toBeGreaterThan(0);
    });

    it.each(seedDocuments)('%s is valid against its $schema', (_, doc) => {
        const validate = ajv.getSchema(doc.$schema);
        expect(validate, `unknown $schema ${doc.$schema}`).toBeDefined();
        validate!(doc);
        expect(ajv.errorsText(validate!.errors, { separator: '\n' })).toBe('No errors');
    });
});
