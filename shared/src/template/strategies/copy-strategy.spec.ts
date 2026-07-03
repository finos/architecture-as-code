import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CopyStrategy } from './copy-strategy';
import { TemplateEngine } from '../template-engine';
import { TemplateEntry, OutputContext } from '../types';
import { Logger } from '../../logger';
import { createMockLogger } from '../../test/test-utils';

vi.mock('fs');

describe('CopyStrategy', () => {
    let mockEngine: TemplateEngine;
    let mockLogger: Logger;
    let strategy: CopyStrategy;

    beforeEach(() => {
        mockEngine = {
            getRawTemplate: vi.fn(),
            getCompiledTemplate: vi.fn(),
            compileTemplate: vi.fn()
        } as unknown as TemplateEngine;

        mockLogger = createMockLogger();

        strategy = new CopyStrategy(mockEngine);

        vi.mocked(fs.mkdirSync).mockImplementation(function () { return undefined; });
        vi.mocked(fs.writeFileSync).mockImplementation(function () { return undefined; });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('copies raw template content to output path', () => {
        const entry: TemplateEntry = {
            template: 'config.js',
            from: 'document',
            output: 'output/config.js',
            'output-type': 'copy'
        };

        const context: OutputContext = {
            data: {},
            outputDir: '/test/output',
            scaffoldOnly: false
        };

        vi.mocked(mockEngine.getRawTemplate).mockReturnValue('const config = {};');

        strategy.process(entry, context, mockLogger);

        expect(fs.mkdirSync).toHaveBeenCalledWith('/test/output/output', { recursive: true });
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            path.join('/test/output', 'output/config.js'),
            'const config = {};',
            'utf8'
        );
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Copied:'));
    });

    it('does nothing when template not found', () => {
        const entry: TemplateEntry = {
            template: 'missing.js',
            from: 'document',
            output: 'output.js',
            'output-type': 'copy'
        };

        const context: OutputContext = {
            data: {},
            outputDir: '/test/output',
            scaffoldOnly: false
        };

        vi.mocked(mockEngine.getRawTemplate).mockReturnValue(undefined);

        strategy.process(entry, context, mockLogger);

        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
});

