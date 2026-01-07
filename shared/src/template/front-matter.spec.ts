import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
    parseFrontMatterFromContent,
    parseFrontMatter,
    hasArchitectureFrontMatter,
    replaceVariables
} from './front-matter';

vi.mock('fs');

describe('FrontMatterParser', () => {
    describe('parseFrontMatterFromContent', () => {
        it('returns content unchanged when no front-matter present', () => {
            const content = '# Hello World\n\nSome content here.';
            const result = parseFrontMatterFromContent(content);

            expect(result.frontMatter).toEqual({});
            expect(result.content).toBe(content);
            expect(result.architecturePath).toBeUndefined();
            expect(result.urlToLocalPathMapping).toBeUndefined();
        });

        it('parses YAML front-matter between --- delimiters', () => {
            const content = `---
title: My Document
author: Test Author
---
# Content Here`;

            const result = parseFrontMatterFromContent(content);

            expect(result.frontMatter).toEqual({
                title: 'My Document',
                author: 'Test Author'
            });
            expect(result.content).toBe('# Content Here');
        });

        it('extracts architecture path without base path', () => {
            const content = `---
architecture: /absolute/path/arch.json
---
Content`;

            const result = parseFrontMatterFromContent(content);

            expect(result.architecturePath).toBe('/absolute/path/arch.json');
        });

        it('resolves relative architecture path with base path', () => {
            const content = `---
architecture: ./relative/arch.json
---
Content`;

            const result = parseFrontMatterFromContent(content, '/base/path');

            expect(result.architecturePath).toBe(path.resolve('/base/path', './relative/arch.json'));
        });

        it('extracts url-to-local-file-mapping and loads JSON', () => {
            const mappingJson = {
                'https://example.com/schema.json': './local/schema.json'
            };

            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mappingJson));

            const content = `---
url-to-local-file-mapping: ./mapping.json
---
Content`;

            const result = parseFrontMatterFromContent(content, '/base/path');

            expect(result.urlToLocalPathMapping).toBeDefined();
            expect(result.urlToLocalPathMapping?.get('https://example.com/schema.json')).toBe(
                path.resolve('/base/path', './local/schema.json')
            );
        });

        it('extracts urlToLocalPathMapping (camelCase variant)', () => {
            const mappingJson = {
                'https://example.com/schema.json': './local/schema.json'
            };

            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mappingJson));

            const content = `---
urlToLocalPathMapping: ./mapping.json
---
Content`;

            const result = parseFrontMatterFromContent(content, '/base/path');

            expect(result.urlToLocalPathMapping).toBeDefined();
        });

        it('stores all front-matter fields', () => {
            const content = `---
focused-node-id: auth-service
custom-var: my-value
architecture: ./arch.json
---
Content`;

            const result = parseFrontMatterFromContent(content, '/base');

            expect(result.frontMatter).toEqual({
                'focused-node-id': 'auth-service',
                'custom-var': 'my-value',
                'architecture': './arch.json'
            });
        });

        it('handles Windows line endings (CRLF)', () => {
            const content = '---\r\ntitle: Test\r\n---\r\nContent here';

            const result = parseFrontMatterFromContent(content);

            expect(result.frontMatter).toEqual({ title: 'Test' });
            expect(result.content).toBe('Content here');
        });

        it('returns empty frontMatter on invalid YAML', () => {
            const content = `---
invalid: yaml: content: [broken
---
Content`;

            const result = parseFrontMatterFromContent(content);

            expect(result.frontMatter).toEqual({});
            expect(result.content).toBe(content);
        });

        it('returns original content when closing --- is missing', () => {
            const content = `---
title: Test
No closing delimiter`;

            const result = parseFrontMatterFromContent(content);

            expect(result.frontMatter).toEqual({});
            expect(result.content).toBe(content);
        });

        it('handles empty front-matter', () => {
            const content = `---
---
Content`;

            const result = parseFrontMatterFromContent(content);

            expect(result.frontMatter).toEqual({});
            expect(result.content).toBe('Content');
        });

        it('stores all types of values in frontMatter', () => {
            const content = `---
string-var: value
number-var: 42
array-var:
  - item1
  - item2
object-var:
  nested: value
---
Content`;

            const result = parseFrontMatterFromContent(content);

            expect(result.frontMatter['string-var']).toBe('value');
            expect(result.frontMatter['number-var']).toBe(42);
            expect(result.frontMatter['array-var']).toEqual(['item1', 'item2']);
            expect(result.frontMatter['object-var']).toEqual({ nested: 'value' });
        });
    });

    describe('parseFrontMatter', () => {
        beforeEach(() => {
            vi.resetAllMocks();
        });

        it('reads file and parses front-matter', () => {
            const fileContent = `---
title: Test
---
Content`;
            vi.mocked(fs.readFileSync).mockReturnValue(fileContent);

            const result = parseFrontMatter('/path/to/file.hbs');

            expect(result).not.toBeNull();
            expect(result?.frontMatter).toEqual({ title: 'Test' });
        });

        it('returns null when file cannot be read', () => {
            vi.mocked(fs.readFileSync).mockImplementation(() => {
                throw new Error('File not found');
            });

            const result = parseFrontMatter('/nonexistent/file.hbs');

            expect(result).toBeNull();
        });

        it('uses file directory as base path for relative paths', () => {
            const fileContent = `---
architecture: ./arch.json
---
Content`;
            vi.mocked(fs.readFileSync).mockReturnValue(fileContent);

            const result = parseFrontMatter('/my/templates/file.hbs');

            expect(result?.architecturePath).toBe(path.resolve('/my/templates', './arch.json'));
        });
    });

    describe('hasArchitectureFrontMatter', () => {
        beforeEach(() => {
            vi.resetAllMocks();
        });

        it('returns true when architecture is specified', () => {
            const fileContent = `---
architecture: ./arch.json
---
Content`;
            vi.mocked(fs.readFileSync).mockReturnValue(fileContent);

            expect(hasArchitectureFrontMatter('/path/to/file.hbs')).toBe(true);
        });

        it('returns false when architecture is not specified', () => {
            const fileContent = `---
title: Test
---
Content`;
            vi.mocked(fs.readFileSync).mockReturnValue(fileContent);

            expect(hasArchitectureFrontMatter('/path/to/file.hbs')).toBe(false);
        });

        it('returns false when file cannot be read', () => {
            vi.mocked(fs.readFileSync).mockImplementation(() => {
                throw new Error('File not found');
            });

            expect(hasArchitectureFrontMatter('/nonexistent/file.hbs')).toBe(false);
        });
    });

    describe('replaceVariables', () => {
        it('replaces single variable placeholder', () => {
            const content = 'Hello {{name}}!';
            const variables = { name: 'World' };

            const result = replaceVariables(content, variables);

            expect(result).toBe('Hello World!');
        });

        it('replaces multiple occurrences of same variable', () => {
            const content = '{{id}} and {{id}} again';
            const variables = { id: 'test-123' };

            const result = replaceVariables(content, variables);

            expect(result).toBe('test-123 and test-123 again');
        });

        it('replaces multiple different variables', () => {
            const content = '{{first}} {{second}} {{third}}';
            const variables = {
                first: 'one',
                second: 'two',
                third: 'three'
            };

            const result = replaceVariables(content, variables);

            expect(result).toBe('one two three');
        });

        it('leaves unknown placeholders unchanged', () => {
            const content = '{{known}} {{unknown}}';
            const variables = { known: 'replaced' };

            const result = replaceVariables(content, variables);

            expect(result).toBe('replaced {{unknown}}');
        });

        it('does not replace Handlebars block expressions', () => {
            const content = '{{#each items}}{{/each}}';
            const variables = { each: 'REPLACED' };

            const result = replaceVariables(content, variables);

            // Block expressions should not be affected
            expect(result).toBe('{{#each items}}{{/each}}');
        });

        it('handles empty variables map', () => {
            const content = 'Hello {{name}}!';
            const result = replaceVariables(content, {});

            expect(result).toBe('Hello {{name}}!');
        });

        it('handles kebab-case variable names', () => {
            const content = '{{focused-node-id}}';
            const variables = { 'focused-node-id': 'auth-service' };

            const result = replaceVariables(content, variables);

            expect(result).toBe('auth-service');
        });
    });
});

