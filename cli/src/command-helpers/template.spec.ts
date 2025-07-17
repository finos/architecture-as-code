import path from 'path';
import { vi } from 'vitest';
import { 
    getUrlToLocalFileMap,
    processBracketNotation,
    flattenArrayAccess,
    flattenObjectArrays,
    extractSchemaProperties,
    extractConfigValues,
    fetchJsonFromUrl,
    fetchConfigData,
    processSimpleTemplate
} from './template';

// Mock the fs module
vi.mock('node:fs', () => ({
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
}));

// Mock fetch for URL requests
global.fetch = vi.fn();

import * as fs from 'node:fs';

describe('getUrlToLocalFileMap', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should return an empty Map when no mapping file is provided', () => {
        const result = getUrlToLocalFileMap();
        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(0);
    });

    it('should return a Map from a valid mapping file', () => {
        const fakePath = '/fake/mapping.json';
        const fakeContent = JSON.stringify({
            'https://calm.finos.org/docuflow/flow/document-upload': 'flows/flow-document-upload.json'
        });

        vi.mocked(fs.readFileSync).mockReturnValue(fakeContent);

        const result = getUrlToLocalFileMap(fakePath);

        const expectedBasePath = path.dirname(fakePath);
        const expectedValue = path.resolve(expectedBasePath, 'flows/flow-document-upload.json');
        const expectedMap = new Map([
            ['https://calm.finos.org/docuflow/flow/document-upload', expectedValue]
        ]);

        expect(result).toEqual(expectedMap);
    });

    it('should log an error and exit process when file reading fails', () => {
        const fakePath = '/fake/mapping.json';

        vi.mocked(fs.readFileSync).mockImplementation(() => {
            throw new Error('read error');
        });
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
            throw new Error(`process.exit: ${code}`);
        });

        expect(() => {
            getUrlToLocalFileMap(fakePath);
        }).toThrowError('process.exit: 1');

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });
});

describe('processBracketNotation', () => {
    it('should process bracket notation and create resolved nodes', () => {
        const templateContent = '{{architecture.nodes[\'api-gateway\'].name}}';
        const architectureData: unknown = {
            nodes: [
                { 'unique-id': 'api-gateway', 'node-type': 'service', name: 'API Gateway', description: 'API Gateway service' },
                { 'unique-id': 'database', 'node-type': 'database', name: 'Database', description: 'Database service' }
            ]
        };

        const result = processBracketNotation(templateContent, architectureData);

        expect(result).toContain('architecture._nodes.api-gateway.name');
        expect((architectureData as Record<string, unknown>)._nodes).toBeDefined();
        expect((architectureData as Record<string, Record<string, unknown>>)._nodes!['api-gateway']).toEqual({ 'unique-id': 'api-gateway', 'node-type': 'service', name: 'API Gateway', description: 'API Gateway service' });
    });

    it('should handle empty nodes array', () => {
        const templateContent = '{{architecture.metadata.name}}';
        const architectureData: unknown = { nodes: [] };

        const result = processBracketNotation(templateContent, architectureData);

        expect(result).toBe(templateContent);
        expect((architectureData as Record<string, unknown>)._nodes).toEqual({});
    });

    it('should handle missing nodes', () => {
        const templateContent = '{{architecture.metadata.name}}';
        const architectureData: unknown = {};

        const result = processBracketNotation(templateContent, architectureData);

        expect(result).toBe(templateContent);
        expect((architectureData as Record<string, unknown>)._nodes).toEqual({});
    });
});

describe('flattenArrayAccess', () => {
    it('should flatten array access in nodes', () => {
        const architectureData: unknown = {
            nodes: [
                {
                    'unique-id': 'test-node',
                    'node-type': 'service',
                    name: 'Test Node',
                    description: 'Test node description',
                    controls: {
                        security: {
                            requirements: ['req1', 'req2']
                        }
                    }
                }
            ]
        };

        flattenArrayAccess(architectureData);

        const node = (architectureData as Record<string, unknown>).nodes[0];
        expect(node.controls.security).toHaveProperty('requirements_0', 'req1');
        expect(node.controls.security).toHaveProperty('requirements_1', 'req2');
    });

    it('should handle missing nodes', () => {
        const architectureData: unknown = {};
        expect(() => flattenArrayAccess(architectureData)).not.toThrow();
    });

    it('should handle non-array nodes', () => {
        const architectureData: unknown = { nodes: 'not-an-array' };
        expect(() => flattenArrayAccess(architectureData)).not.toThrow();
    });
});

describe('flattenObjectArrays', () => {
    it('should flatten arrays in object properties', () => {
        const obj = {
            requirements: ['req1', 'req2', 'req3'],
            metadata: {
                tags: ['tag1', 'tag2']
            }
        };

        flattenObjectArrays(obj);

        expect(obj).toHaveProperty('requirements_0', 'req1');
        expect(obj).toHaveProperty('requirements_1', 'req2');
        expect(obj).toHaveProperty('requirements_2', 'req3');
        expect(obj.metadata).toHaveProperty('tags_0', 'tag1');
        expect(obj.metadata).toHaveProperty('tags_1', 'tag2');
    });

    it('should handle empty arrays', () => {
        const obj = { requirements: [] };
        flattenObjectArrays(obj);
        expect(obj.requirements).toEqual([]);
    });

    it('should handle non-array properties', () => {
        const obj = { name: 'test', value: 42 };
        expect(() => flattenObjectArrays(obj)).not.toThrow();
    });
});

describe('extractSchemaProperties', () => {
    it('should extract properties from JSON schema', () => {
        const schema = {
            properties: {
                name: { type: 'string' },
                age: { type: 'number' },
                active: { type: 'boolean' }
            }
        };

        const result = extractSchemaProperties(schema);

        expect(result).toEqual(['name', 'age', 'active']);
    });

    it('should return empty array for schema without properties', () => {
        const schema = { type: 'string' };
        const result = extractSchemaProperties(schema);
        expect(result).toEqual([]);
    });

    it('should handle null/undefined schema', () => {
        expect(extractSchemaProperties(null)).toEqual([]);
        expect(extractSchemaProperties(undefined)).toEqual([]);
    });
});

describe('extractConfigValues', () => {
    it('should extract config values matching schema properties', () => {
        const config = {
            name: 'Test Service',
            age: 5,
            active: true,
            extra: 'ignored'
        };
        const schema = {
            properties: {
                name: { type: 'string' },
                age: { type: 'number' },
                active: { type: 'boolean' }
            }
        };

        const result = extractConfigValues(config, schema);

        expect(result).toEqual({
            name: 'Test Service',
            age: 5,
            active: true
        });
    });

    it('should handle missing schema properties', () => {
        const config = { name: 'test' };
        const schema = {};

        const result = extractConfigValues(config, schema);
        expect(result).toEqual({});
    });
});

describe('fetchJsonFromUrl', () => {
    beforeEach(() => {
        vi.mocked(fetch).mockClear();
    });

    it('should fetch and parse JSON from URL', async () => {
        const mockData = { name: 'test', version: '1.0' };
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockData)
        } as Response);

        const result = await fetchJsonFromUrl('https://example.com/data.json');

        expect(fetch).toHaveBeenCalledWith('https://example.com/data.json');
        expect(result).toEqual(mockData);
    });

    it('should return null for failed requests', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        } as Response);

        const result = await fetchJsonFromUrl('https://example.com/missing.json');

        expect(result).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
    });

    it('should return null for network errors', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

        const result = await fetchJsonFromUrl('https://example.com/data.json');

        expect(result).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
    });

    it('should return null for invalid URL', async () => {
        const result1 = await fetchJsonFromUrl('');
        const result2 = await fetchJsonFromUrl(null as unknown as string);
        
        expect(result1).toBeNull();
        expect(result2).toBeNull();
    });
});

describe('fetchConfigData', () => {
    beforeEach(() => {
        vi.mocked(fetch).mockClear();
    });

    it('should return inline config object', async () => {
        const config = { name: 'test', value: 42 };
        const result = await fetchConfigData(config);
        expect(result).toEqual(config);
    });

    it('should fetch config from URL', async () => {
        const mockConfig = { setting: 'value' };
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockConfig)
        } as Response);

        const result = await fetchConfigData('https://example.com/config.json');

        expect(fetch).toHaveBeenCalledWith('https://example.com/config.json');
        expect(result).toEqual(mockConfig);
    });

    it('should return null for failed URL fetch', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 404
        } as Response);

        const result = await fetchConfigData('https://example.com/missing.json');
        expect(result).toBeNull();
    });

    it('should return null for network errors', async () => {
        vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

        const result = await fetchConfigData('https://example.com/config.json');
        expect(result).toBeNull();
    });
});

describe('processSimpleTemplate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle errors and exit process', async () => {
        vi.mocked(fs.readFileSync).mockImplementation(() => {
            throw new Error('File not found');
        });
        
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
            throw new Error(`process.exit: ${code}`);
        });

        await expect(processSimpleTemplate(
            '/fake/input.json',
            '/fake/template.hbs',
            '/fake/output.md',
            new Map()
        )).rejects.toThrow('process.exit: 1');

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(1);
        
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
    });
});

describe('fetchConfigData edge cases', () => {
    beforeEach(() => {
        vi.mocked(fetch).mockClear();
    });

    it('should return null for null config', async () => {
        const result = await fetchConfigData(null as unknown as string);
        expect(result).toBeNull();
    });

    it('should return null for undefined config', async () => {
        const result = await fetchConfigData(undefined as unknown as string);
        expect(result).toBeNull();
    });
});
