import { describe, it, expect } from 'vitest';
import {
    hasArchitectureExtension,
    hasMappingFileExtension,
    getFileExtension,
    ARCHITECTURE_EXTENSIONS,
    MAPPING_FILE_EXTENSIONS
} from './file-utils';

describe('file-utils', () => {
    describe('ARCHITECTURE_EXTENSIONS', () => {
        it('should contain only json extension', () => {
            expect(ARCHITECTURE_EXTENSIONS).toContain('.json');
            expect(ARCHITECTURE_EXTENSIONS).toHaveLength(1);
        });
    });

    describe('MAPPING_FILE_EXTENSIONS', () => {
        it('should contain only json extension', () => {
            expect(MAPPING_FILE_EXTENSIONS).toContain('.json');
            expect(MAPPING_FILE_EXTENSIONS).toHaveLength(1);
        });
    });

    describe('hasArchitectureExtension', () => {
        it('should return true for .json files', () => {
            expect(hasArchitectureExtension('/path/to/file.json')).toBe(true);
            expect(hasArchitectureExtension('file.json')).toBe(true);
            expect(hasArchitectureExtension('/path/to/file.JSON')).toBe(true);
        });

        it('should return false for .yaml files', () => {
            expect(hasArchitectureExtension('/path/to/file.yaml')).toBe(false);
            expect(hasArchitectureExtension('file.yaml')).toBe(false);
        });

        it('should return false for .yml files', () => {
            expect(hasArchitectureExtension('/path/to/file.yml')).toBe(false);
            expect(hasArchitectureExtension('file.yml')).toBe(false);
        });

        it('should return false for .txt files', () => {
            expect(hasArchitectureExtension('/path/to/file.txt')).toBe(false);
        });

        it('should return false for .js files', () => {
            expect(hasArchitectureExtension('/path/to/file.js')).toBe(false);
        });

        it('should return false for .md files', () => {
            expect(hasArchitectureExtension('/path/to/file.md')).toBe(false);
        });

        it('should return false for files without extension', () => {
            expect(hasArchitectureExtension('/path/to/file')).toBe(false);
            expect(hasArchitectureExtension('file')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(hasArchitectureExtension('')).toBe(false);
        });
    });

    describe('hasMappingFileExtension', () => {
        it('should return true for .json files', () => {
            expect(hasMappingFileExtension('/path/to/mapping.json')).toBe(true);
        });

        it('should return false for .yaml files', () => {
            expect(hasMappingFileExtension('/path/to/mapping.yaml')).toBe(false);
        });

        it('should return false for .yml files', () => {
            expect(hasMappingFileExtension('/path/to/mapping.yml')).toBe(false);
        });

        it('should return false for non-mapping extensions', () => {
            expect(hasMappingFileExtension('/path/to/file.txt')).toBe(false);
            expect(hasMappingFileExtension('/path/to/file.md')).toBe(false);
        });
    });

    describe('getFileExtension', () => {
        it('should return extension with dot for valid files', () => {
            expect(getFileExtension('/path/to/file.json')).toBe('.json');
            expect(getFileExtension('/path/to/file.yaml')).toBe('.yaml');
            expect(getFileExtension('/path/to/file.yml')).toBe('.yml');
            expect(getFileExtension('file.txt')).toBe('.txt');
        });

        it('should return lowercase extension', () => {
            expect(getFileExtension('/path/to/file.JSON')).toBe('.json');
            expect(getFileExtension('/path/to/file.YAML')).toBe('.yaml');
            expect(getFileExtension('/path/to/file.TXT')).toBe('.txt');
        });

        it('should return empty string for files without extension', () => {
            expect(getFileExtension('/path/to/file')).toBe('');
            expect(getFileExtension('file')).toBe('');
        });

        it('should return empty string for empty input', () => {
            expect(getFileExtension('')).toBe('');
        });

        it('should handle files with multiple dots', () => {
            expect(getFileExtension('/path/to/file.test.json')).toBe('.json');
            expect(getFileExtension('my.config.yaml')).toBe('.yaml');
        });
    });
});
