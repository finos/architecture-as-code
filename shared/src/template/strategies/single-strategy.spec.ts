import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SingleStrategy } from './single-strategy';
import { TemplateEngine } from '../template-engine';
import { TemplateEntry, OutputContext } from '../types';
import { Logger } from '../../logger';

vi.mock('fs');
vi.mock('../front-matter', () => ({
    injectFrontMatter: vi.fn((content) => `---\ninjected: true\n---\n${content}`)
}));

describe('SingleStrategy', () => {
    let mockEngine: TemplateEngine;
    let mockLogger: Logger;
    let strategy: SingleStrategy;

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

        strategy = new SingleStrategy(mockEngine);

        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
        vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('scaffold mode', () => {
        it('copies raw template with front-matter for .md files', () => {
            const entry: TemplateEntry = {
                template: 'index.md.hbs',
                from: 'document',
                output: 'docs/index.md',
                'output-type': 'single'
            };

            const context: OutputContext = {
                data: { title: 'Test' },
                outputDir: '/test/output',
                scaffoldOnly: true,
                scaffoldPaths: {
                    architecturePath: '/path/to/arch.json',
                    urlMappingPath: '/path/to/mapping.json'
                }
            };

            vi.mocked(mockEngine.getRawTemplate).mockReturnValue('# {{title}}');

            strategy.process(entry, context, mockLogger);

            expect(fs.writeFileSync).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Scaffolded:'));
        });

        it('skips front-matter injection when inject is false', () => {
            const entry: TemplateEntry = {
                template: 'sidebar.js.hbs',
                from: 'document',
                output: 'sidebars.js',
                'output-type': 'single',
                'front-matter': { inject: false }
            };

            const context: OutputContext = {
                data: {},
                outputDir: '/test/output',
                scaffoldOnly: true,
                scaffoldPaths: {
                    architecturePath: '/path/to/arch.json'
                }
            };

            vi.mocked(mockEngine.getRawTemplate).mockReturnValue('module.exports = {};');

            strategy.process(entry, context, mockLogger);

            const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
            expect(writeCall[1]).toBe('module.exports = {};');
        });
    });

    describe('render mode', () => {
        it('renders template with data context', () => {
            const entry: TemplateEntry = {
                template: 'index.md.hbs',
                from: 'document',
                output: 'docs/index.md',
                'output-type': 'single'
            };

            const testData = { document: { title: 'My Title' } };
            const context: OutputContext = {
                data: testData,
                outputDir: '/test/output',
                scaffoldOnly: false
            };

            const mockCompiledTemplate = vi.fn().mockReturnValue('# My Title');
            vi.mocked(mockEngine.getCompiledTemplate).mockReturnValue(mockCompiledTemplate);

            strategy.process(entry, context, mockLogger);

            expect(mockCompiledTemplate).toHaveBeenCalledWith(
                expect.objectContaining({
                    _root: testData,
                    _architecture: testData.document
                })
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('index.md'),
                '# My Title',
                'utf8'
            );
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Generated:'));
        });

        it('warns and skips when template not found', () => {
            const entry: TemplateEntry = {
                template: 'missing.hbs',
                from: 'document',
                output: 'output.md',
                'output-type': 'single'
            };

            const context: OutputContext = {
                data: {},
                outputDir: '/test/output',
                scaffoldOnly: false
            };

            vi.mocked(mockEngine.getCompiledTemplate).mockReturnValue(undefined);

            strategy.process(entry, context, mockLogger);

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping unknown template'));
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it('substitutes {{id}} in output path', () => {
            const entry: TemplateEntry = {
                template: 'item.hbs',
                from: 'document.item',
                output: 'items/{{id}}.md',
                'output-type': 'single'
            };

            const context: OutputContext = {
                data: { document: { item: { id: 'my-item', name: 'Test' } } },
                outputDir: '/test/output',
                scaffoldOnly: false
            };

            const mockCompiledTemplate = vi.fn().mockReturnValue('Item content');
            vi.mocked(mockEngine.getCompiledTemplate).mockReturnValue(mockCompiledTemplate);

            strategy.process(entry, context, mockLogger);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/output', 'items/my-item.md'),
                'Item content',
                'utf8'
            );
        });

        it('includes front-matter variables in template context', () => {
            const entry: TemplateEntry = {
                template: 'template.hbs',
                from: 'document',
                output: 'output.md',
                'output-type': 'single',
                'front-matter': {
                    variables: { 'custom-var': 'custom-value' }
                }
            };

            const context: OutputContext = {
                data: { document: { title: 'Test' } },
                outputDir: '/test/output',
                scaffoldOnly: false
            };

            const mockCompiledTemplate = vi.fn().mockReturnValue('content');
            vi.mocked(mockEngine.getCompiledTemplate).mockReturnValue(mockCompiledTemplate);

            strategy.process(entry, context, mockLogger);

            expect(mockCompiledTemplate).toHaveBeenCalledWith(
                expect.objectContaining({
                    'custom-var': 'custom-value'
                })
            );
        });
    });
});

