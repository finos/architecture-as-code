import path from 'path';
import { vi } from 'vitest';
import { getUrlToLocalFileMap } from './template';

// Mock the fs module
vi.mock('node:fs', () => ({
    readFileSync: vi.fn(),
}));

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
