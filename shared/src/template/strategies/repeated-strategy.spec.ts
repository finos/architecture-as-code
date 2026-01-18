import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RepeatedStrategy } from './repeated-strategy';
import { TemplateEngine } from '../template-engine';
import { TemplateEntry, OutputContext } from '../types';
import { Logger } from '../../logger';

vi.mock('fs');
vi.mock('../front-matter', () => ({
    injectFrontMatter: vi.fn((content, _path, params) =>
        `---\ninjected: true\nitemId: ${params.itemId || 'none'}\n---\n${content}`)
}));
vi.mock('../template-preprocessor', () => ({
    TemplatePreprocessor: {
        preprocessTemplate: vi.fn((input) => input)
    }
}));

describe('RepeatedStrategy', () => {
    let mockEngine: TemplateEngine;
    let mockLogger: Logger;
    let strategy: RepeatedStrategy;

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

        strategy = new RepeatedStrategy(mockEngine);

        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
        vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('scaffold mode', () => {
        it('creates one file per item in array', () => {
            const entry: TemplateEntry = {
                template: 'node.mdx.hbs',
                from: 'document.nodes',
                output: 'docs/nodes/{{unique-id}}.md',
                'output-type': 'repeated',
                'front-matter': {
                    variables: { 'node-id': '{{id}}' }
                }
            };

            const context: OutputContext = {
                data: {
                    document: {
                        nodes: [
                            { 'unique-id': 'node-1', name: 'Node 1' },
                            { 'unique-id': 'node-2', name: 'Node 2' }
                        ]
                    }
                },
                outputDir: '/test/output',
                scaffoldOnly: true,
                scaffoldPaths: {
                    architecturePath: '/path/to/arch.json'
                }
            };

            vi.mocked(mockEngine.getRawTemplate).mockReturnValue('# {{name}}');

            strategy.process(entry, context, mockLogger);

            expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/output', 'docs/nodes/node-1.md'),
                expect.any(String),
                'utf8'
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/output', 'docs/nodes/node-2.md'),
                expect.any(String),
                'utf8'
            );
        });

        it('uses id-key to get item identifier', () => {
            const entry: TemplateEntry = {
                template: 'item.hbs',
                from: 'document.items',
                output: 'items/{{unique-id}}.md',
                'output-type': 'repeated',
                'id-key': 'custom-id'
            };

            const context: OutputContext = {
                data: {
                    document: {
                        items: [
                            { 'custom-id': 'custom-1', name: 'Item 1' }
                        ]
                    }
                },
                outputDir: '/test/output',
                scaffoldOnly: true,
                scaffoldPaths: { architecturePath: '/arch.json' }
            };

            vi.mocked(mockEngine.getRawTemplate).mockReturnValue('content');

            strategy.process(entry, context, mockLogger);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/output', 'items/custom-1.md'),
                expect.any(String),
                'utf8'
            );
        });

        it('warns when data source is not an array', () => {
            const entry: TemplateEntry = {
                template: 'node.hbs',
                from: 'document.nodes',
                output: 'nodes/{{unique-id}}.md',
                'output-type': 'repeated'
            };

            const context: OutputContext = {
                data: { document: { nodes: 'not-an-array' } },
                outputDir: '/test/output',
                scaffoldOnly: true
            };

            strategy.process(entry, context, mockLogger);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Expected array for repeated output')
            );
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });
    });

    describe('render mode', () => {
        it('renders template for each item with full document context', () => {
            const entry: TemplateEntry = {
                template: 'node.mdx.hbs',
                from: 'document.nodes',
                output: 'docs/nodes/{{unique-id}}.md',
                'output-type': 'repeated',
                'front-matter': {
                    variables: { 'node-id': '{{id}}' }
                }
            };

            const context: OutputContext = {
                data: {
                    document: {
                        nodes: [
                            { 'unique-id': 'node-1', name: 'Node 1' },
                            { 'unique-id': 'node-2', name: 'Node 2' }
                        ],
                        relationships: []
                    }
                },
                outputDir: '/test/output',
                scaffoldOnly: false
            };

            const mockCompiledTemplate = vi.fn().mockReturnValue('rendered content');
            vi.mocked(mockEngine.getCompiledTemplate).mockReturnValue(mockCompiledTemplate);
            vi.mocked(mockEngine.getRawTemplate).mockReturnValue('raw template');
            vi.mocked(mockEngine.compileTemplate).mockReturnValue(mockCompiledTemplate);

            strategy.process(entry, context, mockLogger);

            expect(mockCompiledTemplate).toHaveBeenCalledTimes(2);
            expect(mockCompiledTemplate).toHaveBeenCalledWith(
                expect.objectContaining({
                    _root: context.data,
                    _architecture: context.data.document,
                    'node-id': 'node-1'
                })
            );
            expect(mockCompiledTemplate).toHaveBeenCalledWith(
                expect.objectContaining({
                    'node-id': 'node-2'
                })
            );
        });

        it('replaces id-type variable in raw template before compiling', () => {
            const entry: TemplateEntry = {
                template: 'node.hbs',
                from: 'document.nodes',
                output: 'nodes/{{unique-id}}.md',
                'output-type': 'repeated',
                'front-matter': {
                    variables: { 'node-id': '{{id}}' }
                }
            };

            const context: OutputContext = {
                data: {
                    document: {
                        nodes: [{ 'unique-id': 'test-node' }]
                    }
                },
                outputDir: '/test/output',
                scaffoldOnly: false
            };

            const mockCompiledTemplate = vi.fn().mockReturnValue('output');
            vi.mocked(mockEngine.getCompiledTemplate).mockReturnValue(mockCompiledTemplate);
            vi.mocked(mockEngine.getRawTemplate).mockReturnValue('Node: {{node-id}}');
            vi.mocked(mockEngine.compileTemplate).mockReturnValue(mockCompiledTemplate);

            strategy.process(entry, context, mockLogger);

            expect(mockEngine.compileTemplate).toHaveBeenCalledWith('Node: test-node');
        });

        it('warns and skips when template not found', () => {
            const entry: TemplateEntry = {
                template: 'missing.hbs',
                from: 'document.nodes',
                output: 'nodes/{{unique-id}}.md',
                'output-type': 'repeated'
            };

            const context: OutputContext = {
                data: { document: { nodes: [{ 'unique-id': 'n1' }] } },
                outputDir: '/test/output',
                scaffoldOnly: false
            };

            vi.mocked(mockEngine.getCompiledTemplate).mockReturnValue(undefined);

            strategy.process(entry, context, mockLogger);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Skipping unknown template')
            );
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it('falls back to id when unique-id not present', () => {
            const entry: TemplateEntry = {
                template: 'item.hbs',
                from: 'document.items',
                output: 'items/{{unique-id}}.md',
                'output-type': 'repeated'
            };

            const context: OutputContext = {
                data: {
                    document: {
                        items: [{ id: 'fallback-id', name: 'Item' }]
                    }
                },
                outputDir: '/test/output',
                scaffoldOnly: false
            };

            const mockCompiledTemplate = vi.fn().mockReturnValue('content');
            vi.mocked(mockEngine.getCompiledTemplate).mockReturnValue(mockCompiledTemplate);

            strategy.process(entry, context, mockLogger);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/output', 'items/fallback-id.md'),
                expect.any(String),
                'utf8'
            );
        });
    });
});

