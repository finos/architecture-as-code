import { vi } from 'vitest';
vi.mock('../logger.js', () => ({
    initLogger: () => ({ info: vi.fn(), debug: () => {} })
}));

import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { TemplateCalmFileDereferencer } from './template-calm-file-dereferencer.js';
import { InMemoryResolver } from '../resolver/calm-reference-resolver.js';

let dereferencer: TemplateCalmFileDereferencer;
let urlFileMapping: Map<string, string>;
let resolver: InMemoryResolver;

describe('TemplateCalmFileDereferencer', () => {
    beforeEach(() => {
        const file1Path = path.resolve(__dirname, 'file1.json');
        urlFileMapping = new Map([
            ['http://mapped.example.com/one', file1Path]
        ]);

        const mockData: Record<string, unknown> = {
            'http://mapped.example.com/one': { data: 'from-file1' },
            [file1Path]: { data: 'from-file1' },
            'http://schema.example.com/req': {
                $schema: 'https://json-schema.org/draft/2020-12/schema',
                properties: { foo: { type: 'string' } }
            },
            'http://schema.example.com/impl': {
                $schema: 'https://json-schema.org/draft/2020-12/schema'
            }
        };

        resolver = new InMemoryResolver(mockData);
        dereferencer = new TemplateCalmFileDereferencer(urlFileMapping, resolver);
    });

    it('replaces mapped URLs with file refs', async () => {
        const doc = JSON.stringify({ url: 'http://mapped.example.com/one' });
        const output = await dereferencer.dereferenceCalmDoc(doc);
        const parsed = JSON.parse(output);
        expect(parsed.url).toEqual({ data: 'from-file1' });
    });

    it('inlines JSON‐Schema definitions correctly', async () => {
        const doc = JSON.stringify({ schemaUrl: 'http://schema.example.com/req' });
        const output = await dereferencer.dereferenceCalmDoc(doc);
        const parsed = JSON.parse(output);
        expect(parsed.schemaUrl).toEqual('http://schema.example.com/req');
    });

    it('inlines JSON-Schema implementations correctly via detailed-architecture reference', async () => {
        const firstDocUrl = 'http://schema.example.com/firstDoc';
        const implUrl     = 'http://schema.example.com/impl';

        urlFileMapping = new Map();

        const mockData: Record<string, unknown> = {
            [firstDocUrl]: {
                $id: firstDocUrl,
                $schema: 'https://json-schema.org/draft/2020-12/schema',
                'detailed-architecture': implUrl
            },
            [implUrl]: {
                $id: implUrl,
                $schema: 'https://json-schema.org/draft/2020-12/schema'
            }
        };

        resolver     = new InMemoryResolver(mockData);
        dereferencer = new TemplateCalmFileDereferencer(urlFileMapping, resolver);

        const input  = JSON.stringify(mockData[firstDocUrl]);
        const output = await dereferencer.dereferenceCalmDoc(input);
        const parsed = JSON.parse(output);

        expect(parsed).toEqual({
            $id: firstDocUrl,
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            'detailed-architecture': {
                $id: implUrl,
                $schema: 'https://json-schema.org/draft/2020-12/schema'
            }
        });
    });


    it('leaves unreachable URLs intact', async () => {
        const doc = JSON.stringify({ url: 'http://unreachable.example.com/three' });
        const output = await dereferencer.dereferenceCalmDoc(doc);
        const parsed = JSON.parse(output);
        expect(parsed.url).toBe('http://unreachable.example.com/three');
    });

    it('recurses nested structures', async () => {
        const nestedDoc = {
            arr: [
                'http://mapped.example.com/one',
                { nestedSchema: 'http://schema.example.com/req' },
                'http://unreachable.example.com/three'
            ]
        };
        const output = await dereferencer.dereferenceCalmDoc(JSON.stringify(nestedDoc));
        const parsed = JSON.parse(output);
        expect(parsed.arr[0]).toEqual({ data: 'from-file1' });
        expect(parsed.arr[1].nestedSchema).toEqual('http://schema.example.com/req');
        expect(parsed.arr[2]).toBe('http://unreachable.example.com/three');
    });

    it('follows two levels of detailed-architecture references and inlines the final document', async () => {
        const firstDocUrl     = 'http://schema.example.com/firstDoc';
        const implUrl         = 'http://schema.example.com/impl';
        const partialImplUrl  = 'http://schema.example.com/partialImpl';

        const urlFileMapping = new Map<string, string>();

        const mockData: Record<string, unknown> = {
            [partialImplUrl]: {
                $id: partialImplUrl,
                $schema: 'https://json-schema.org/draft/2020-12/schema'
            },
            [implUrl]: {
                $id: implUrl,
                $schema: 'https://json-schema.org/draft/2020-12/schema',
                'detailed-architecture': partialImplUrl
            },
            [firstDocUrl]: {
                $id: firstDocUrl,
                $schema: 'https://json-schema.org/draft/2020-12/schema',
                'detailed-architecture': implUrl
            }
        };

        const resolver     = new InMemoryResolver(mockData);
        const dereferencer = new TemplateCalmFileDereferencer(urlFileMapping, resolver);

        const firstDoc = mockData[firstDocUrl];
        const input  = JSON.stringify(firstDoc);
        const output = await dereferencer.dereferenceCalmDoc(input);
        const parsed = JSON.parse(output);

        expect(parsed).toEqual({
            $id: firstDocUrl,
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            'detailed-architecture': {
                $id: implUrl,
                $schema: 'https://json-schema.org/draft/2020-12/schema',
                'detailed-architecture': {
                    $id: partialImplUrl,
                    $schema: 'https://json-schema.org/draft/2020-12/schema'
                }
            }
        });
    });
});
