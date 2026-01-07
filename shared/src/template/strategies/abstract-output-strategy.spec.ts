import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AbstractOutputStrategy } from './abstract-output-strategy';
import { TemplateEngine } from '../template-engine';
import { TemplateEntry, OutputContext } from '../types';
import { Logger } from '../../logger';

vi.mock('fs');
vi.mock('../front-matter', () => ({
    injectFrontMatter: vi.fn((content, _path, params) =>
        `---\narch: ${params.architecturePath}\n---\n${content}`)
}));

class TestStrategy extends AbstractOutputStrategy {
    process(_entry: TemplateEntry, _context: OutputContext, _logger: Logger): void {
        // Expose protected methods for testing
    }

    // Expose protected methods
    public testShouldInjectFrontMatter(entry: TemplateEntry): boolean {
        return this.shouldInjectFrontMatter(entry);
    }

    public testResolvePath(data: Record<string, unknown>, dotPath: string): unknown {
        return this.resolvePath(data, dotPath);
    }

    public testWriteFile(outputPath: string, content: string, logger: Logger, logPrefix: string): void {
        return this.writeFile(outputPath, content, logger, logPrefix);
    }

    public testApplyFrontMatter(
        content: string,
        outputPath: string,
        context: OutputContext,
        frontMatterConfig: TemplateEntry['front-matter'],
        shouldInject: boolean,
        itemId?: string
    ): string {
        return this.applyFrontMatter(content, outputPath, context, frontMatterConfig, shouldInject, itemId);
    }

    public testBuildOutputPath(outputDir: string, filename: string): string {
        return this.buildOutputPath(outputDir, filename);
    }
}

describe('AbstractOutputStrategy', () => {
    let mockEngine: TemplateEngine;
    let mockLogger: Logger;
    let strategy: TestStrategy;

    beforeEach(() => {
        mockEngine = {
            getRawTemplate: vi.fn(),
            getCompiledTemplate: vi.fn(),
            compileTemplate: vi.fn()
        } as unknown as TemplateEngine;

        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            error: vi.fn()
        } as unknown as Logger;

        strategy = new TestStrategy(mockEngine);

        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
        vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('shouldInjectFrontMatter', () => {
        it('returns true for .md files by default', () => {
            const entry: TemplateEntry = {
                template: 'test.hbs',
                from: 'document',
                output: 'output.md',
                'output-type': 'single'
            };

            expect(strategy.testShouldInjectFrontMatter(entry)).toBe(true);
        });

        it('returns true for .mdx files by default', () => {
            const entry: TemplateEntry = {
                template: 'test.hbs',
                from: 'document',
                output: 'output.mdx',
                'output-type': 'single'
            };

            expect(strategy.testShouldInjectFrontMatter(entry)).toBe(true);
        });

        it('returns false for .js files by default', () => {
            const entry: TemplateEntry = {
                template: 'test.hbs',
                from: 'document',
                output: 'output.js',
                'output-type': 'single'
            };

            expect(strategy.testShouldInjectFrontMatter(entry)).toBe(false);
        });

        it('respects explicit inject: false', () => {
            const entry: TemplateEntry = {
                template: 'test.hbs',
                from: 'document',
                output: 'output.md',
                'output-type': 'single',
                'front-matter': { inject: false }
            };

            expect(strategy.testShouldInjectFrontMatter(entry)).toBe(false);
        });

        it('respects explicit inject: true for non-.md files', () => {
            const entry: TemplateEntry = {
                template: 'test.hbs',
                from: 'document',
                output: 'output.txt',
                'output-type': 'single',
                'front-matter': { inject: true }
            };

            expect(strategy.testShouldInjectFrontMatter(entry)).toBe(true);
        });
    });

    describe('resolvePath', () => {
        it('resolves simple path', () => {
            const data = { title: 'Test' };
            expect(strategy.testResolvePath(data, 'title')).toBe('Test');
        });

        it('resolves nested path', () => {
            const data = { document: { metadata: { version: '1.0' } } };
            expect(strategy.testResolvePath(data, 'document.metadata.version')).toBe('1.0');
        });

        it('returns undefined for missing path', () => {
            const data = { document: {} };
            expect(strategy.testResolvePath(data, 'document.missing.path')).toBeUndefined();
        });
    });

    describe('writeFile', () => {
        it('creates directory and writes file', () => {
            strategy.testWriteFile('/output/path/file.md', 'content', mockLogger, '✅ Generated:');

            expect(fs.mkdirSync).toHaveBeenCalledWith('/output/path', { recursive: true });
            expect(fs.writeFileSync).toHaveBeenCalledWith('/output/path/file.md', 'content', 'utf8');
            expect(mockLogger.info).toHaveBeenCalledWith('✅ Generated: /output/path/file.md');
        });
    });

    describe('applyFrontMatter', () => {
        it('returns original content when shouldInject is false', () => {
            const context: OutputContext = {
                data: {},
                outputDir: '/output',
                scaffoldOnly: false,
                scaffoldPaths: { architecturePath: '/arch.json' }
            };

            const result = strategy.testApplyFrontMatter(
                'content', '/output/file.md', context, undefined, false
            );

            expect(result).toBe('content');
        });

        it('returns original content when scaffoldPaths not provided', () => {
            const context: OutputContext = {
                data: {},
                outputDir: '/output',
                scaffoldOnly: false
            };

            const result = strategy.testApplyFrontMatter(
                'content', '/output/file.md', context, undefined, true
            );

            expect(result).toBe('content');
        });

        it('injects front-matter when conditions met', () => {
            const context: OutputContext = {
                data: {},
                outputDir: '/output',
                scaffoldOnly: false,
                scaffoldPaths: { architecturePath: '/arch.json' }
            };

            const result = strategy.testApplyFrontMatter(
                'content', '/output/file.md', context, undefined, true
            );

            expect(result).toContain('---');
            expect(result).toContain('content');
        });
    });

    describe('buildOutputPath', () => {
        it('joins output directory and filename', () => {
            const result = strategy.testBuildOutputPath('/base/output', 'docs/file.md');
            expect(result).toBe(path.join('/base/output', 'docs/file.md'));
        });
    });
});

