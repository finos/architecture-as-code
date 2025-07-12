import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { loadJsonFromFile } from './command-helpers/file-input.js';
import { loadCliConfig } from './cli-config.js';

// Mock fs module
vi.mock('fs/promises');

describe('CLI Utility Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('loadJsonFromFile', () => {
        it('should load valid JSON file successfully', async () => {
            const mockJsonContent = '{"name": "test", "version": "1.0.0"}';
            vi.mocked(fs.readFile).mockResolvedValue(mockJsonContent);
      
            const result = await loadJsonFromFile('test.json');
      
            expect(result).toEqual({ name: 'test', version: '1.0.0' });
            expect(fs.readFile).toHaveBeenCalledWith('test.json', 'utf-8');
        });

        it('should handle file not found error', async () => {
            const error = new Error('ENOENT: no such file or directory');
            error.code = 'ENOENT';
            vi.mocked(fs.readFile).mockRejectedValue(error);
      
            await expect(loadJsonFromFile('nonexistent.json')).rejects.toThrow();
        });

        it('should handle invalid JSON syntax', async () => {
            const invalidJson = '{"invalid": json syntax}';
            vi.mocked(fs.readFile).mockResolvedValue(invalidJson);
      
            await expect(loadJsonFromFile('invalid.json')).rejects.toThrow();
        });

        it('should handle empty file', async () => {
            vi.mocked(fs.readFile).mockResolvedValue('');
      
            await expect(loadJsonFromFile('empty.json')).rejects.toThrow();
        });

        it('should handle different file extensions', async () => {
            const mockContent = '{"type": "config"}';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);
      
            await loadJsonFromFile('config.json');
            await loadJsonFromFile('data.calm');
            await loadJsonFromFile('pattern.yaml');
      
            expect(fs.readFile).toHaveBeenCalledTimes(3);
        });

        it('should handle complex JSON structures', async () => {
            const complexJson = JSON.stringify({
                metadata: { version: '2.0', author: 'test' },
                nodes: [
                    { id: 'node1', type: 'service', properties: { port: 8080 } },
                    { id: 'node2', type: 'database', properties: { host: 'localhost' } }
                ],
                relationships: [
                    { from: 'node1', to: 'node2', type: 'connects' }
                ]
            });
      
            vi.mocked(fs.readFile).mockResolvedValue(complexJson);
      
            const result = await loadJsonFromFile('complex.json');
      
            expect(result.metadata.version).toBe('2.0');
            expect(result.nodes).toHaveLength(2);
            expect(result.relationships).toHaveLength(1);
        });

        it('should handle file paths with special characters', async () => {
            const mockContent = '{"special": "path"}';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);
      
            const specialPaths = [
                'file with spaces.json',
                'file-with-dashes.json',
                'file_with_underscores.json',
                './relative/path.json',
                '/absolute/path.json'
            ];
      
            for (const path of specialPaths) {
                const result = await loadJsonFromFile(path);
                expect(result).toEqual({ special: 'path' });
            }
        });
    });

    describe('loadCliConfig', () => {
        it('should load valid config file', async () => {
            const mockConfigContent = '{"calmHubUrl": "https://hub.example.com", "debug": true}';
            vi.mocked(fs.readFile).mockResolvedValue(mockConfigContent);
      
            const result = await loadCliConfig();
      
            expect(result).toEqual({ calmHubUrl: 'https://hub.example.com', debug: true });
        });

        it('should return empty object when config file does not exist', async () => {
            const error = new Error('ENOENT: no such file or directory');
            error.code = 'ENOENT';
            vi.mocked(fs.readFile).mockRejectedValue(error);
      
            const result = await loadCliConfig();
      
            expect(result).toBeNull();
        });

        it('should return empty object when config file has invalid JSON', async () => {
            vi.mocked(fs.readFile).mockResolvedValue('invalid json content');
      
            const result = await loadCliConfig();
      
            expect(result).toBeNull();
        });

        it('should handle empty config file', async () => {
            vi.mocked(fs.readFile).mockResolvedValue('{}');
      
            const result = await loadCliConfig();
      
            expect(result).toEqual({});
        });

        it('should handle config with various data types', async () => {
            const configContent = JSON.stringify({
                calmHubUrl: 'https://hub.example.com',
                debug: true,
                timeout: 5000,
                retries: 3,
                features: ['feature1', 'feature2'],
                nested: {
                    option1: 'value1',
                    option2: false
                }
            });
      
            vi.mocked(fs.readFile).mockResolvedValue(configContent);
      
            const result = await loadCliConfig();
      
            expect(result.calmHubUrl).toBe('https://hub.example.com');
            expect(result.debug).toBe(true);
            expect(result.timeout).toBe(5000);
            expect(result.features).toEqual(['feature1', 'feature2']);
            expect(result.nested.option1).toBe('value1');
        });

        it('should handle permission errors gracefully', async () => {
            const error = new Error('EACCES: permission denied');
            error.code = 'EACCES';
            vi.mocked(fs.readFile).mockRejectedValue(error);
      
            const result = await loadCliConfig();
      
            expect(result).toBeNull();
        });
    });

    describe('error handling scenarios', () => {
        it('should handle concurrent file operations', async () => {
            const mockContent = '{"concurrent": "test"}';
            vi.mocked(fs.readFile).mockResolvedValue(mockContent);
      
            const promises = [
                loadJsonFromFile('file1.json'),
                loadJsonFromFile('file2.json'),
                loadCliConfig()
            ];
      
            const results = await Promise.all(promises);
      
            expect(results).toHaveLength(3);
            expect(results[0]).toEqual({ concurrent: 'test' });
            expect(results[1]).toEqual({ concurrent: 'test' });
            expect(results[2]).toEqual({ concurrent: 'test' });
        });

        it('should handle large files', async () => {
            const largeObject = {
                data: new Array(1000).fill({ id: 'item', value: 'test' }),
                metadata: { size: 'large' }
            };
            const largeJson = JSON.stringify(largeObject);
      
            vi.mocked(fs.readFile).mockResolvedValue(largeJson);
      
            const result = await loadJsonFromFile('large.json');
      
            expect(result.data).toHaveLength(1000);
            expect(result.metadata.size).toBe('large');
        });

        it('should handle network-like errors', async () => {
            const networkError = new Error('ETIMEDOUT: connection timed out');
            networkError.code = 'ETIMEDOUT';
            vi.mocked(fs.readFile).mockRejectedValue(networkError);
      
            await expect(loadJsonFromFile('network-file.json')).rejects.toThrow('ETIMEDOUT');
        });

        it('should handle disk space errors', async () => {
            const diskError = new Error('ENOSPC: no space left on device');
            diskError.code = 'ENOSPC';
            vi.mocked(fs.readFile).mockRejectedValue(diskError);
      
            await expect(loadJsonFromFile('space-test.json')).rejects.toThrow('ENOSPC');
        });
    });

    describe('edge cases', () => {
        it('should handle JSON with null values', async () => {
            const jsonWithNulls = '{"value": null, "array": [null, "test", null]}';
            vi.mocked(fs.readFile).mockResolvedValue(jsonWithNulls);
      
            const result = await loadJsonFromFile('nulls.json');
      
            expect(result.value).toBeNull();
            expect(result.array).toEqual([null, 'test', null]);
        });

        it('should handle JSON with unicode characters', async () => {
            const unicodeJson = '{"message": "Hello 世界", "emoji": "🚀", "special": "café"}';
            vi.mocked(fs.readFile).mockResolvedValue(unicodeJson);
      
            const result = await loadJsonFromFile('unicode.json');
      
            expect(result.message).toBe('Hello 世界');
            expect(result.emoji).toBe('🚀');
            expect(result.special).toBe('café');
        });

        it('should handle very deeply nested JSON', async () => {
            const deepObject = { level1: { level2: { level3: { level4: { value: 'deep' } } } } };
            const deepJson = JSON.stringify(deepObject);
            vi.mocked(fs.readFile).mockResolvedValue(deepJson);
      
            const result = await loadJsonFromFile('deep.json');
      
            expect(result.level1.level2.level3.level4.value).toBe('deep');
        });

        it('should handle JSON with very long strings', async () => {
            const longString = 'a'.repeat(10000);
            const jsonWithLongString = JSON.stringify({ longValue: longString });
            vi.mocked(fs.readFile).mockResolvedValue(jsonWithLongString);
      
            const result = await loadJsonFromFile('long.json');
      
            expect(result.longValue).toHaveLength(10000);
            expect(result.longValue).toBe(longString);
        });
    });
});
