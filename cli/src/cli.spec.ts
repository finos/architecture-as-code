import {
    Docifier,
    DocifyMode,
    TemplateProcessingMode,
    TemplateProcessor,
    DocumentLoader
} from '@finos/calm-shared';
import { Command } from 'commander';
import { MockInstance } from 'vitest';

let calmShared: typeof import('@finos/calm-shared');
let validateModule: typeof import('./command-helpers/validate');
let templateModule: typeof import('./command-helpers/template');
let optionsModule: typeof import('./command-helpers/generate-options');
let diffModule: typeof import('./command-helpers/diff');
let hubCommandsModule: typeof import('./command-helpers/hub-commands');
let _fileSystemDocLoaderModule: typeof import('@finos/calm-shared/dist/document-loader/file-system-document-loader');
let documentLoaderModule: typeof import('../../shared/src/document-loader/document-loader');
let setupCLI: typeof import('./cli').setupCLI;
let cliConfigModule: typeof import('./cli-config');

describe('CLI Commands', () => {
    let program: Command;
    let mockDocLoader: DocumentLoader;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        calmShared = await import('@finos/calm-shared');
        validateModule = await import('./command-helpers/validate');
        templateModule = await import('./command-helpers/template');
        optionsModule = await import('./command-helpers/generate-options');
        diffModule = await import('./command-helpers/diff');
        _fileSystemDocLoaderModule = await import('@finos/calm-shared/dist/document-loader/file-system-document-loader');
        documentLoaderModule = await import('../../shared/src/document-loader/document-loader');

        vi.spyOn(calmShared, 'runGenerate').mockResolvedValue(undefined);
        vi.spyOn(calmShared.TemplateProcessor.prototype, 'processTemplate').mockResolvedValue(undefined);
        vi.spyOn(calmShared.Docifier.prototype, 'docify').mockResolvedValue(undefined);

        vi.spyOn(validateModule, 'runValidate').mockResolvedValue(undefined);
        vi.spyOn(validateModule, 'checkValidateOptions').mockResolvedValue(undefined);

        vi.spyOn(diffModule, 'runDiffCommand').mockResolvedValue(false);

        vi.spyOn(templateModule, 'getUrlToLocalFileMap').mockReturnValue(new Map());

        vi.spyOn(optionsModule, 'promptUserForOptions').mockResolvedValue([]);

        mockDocLoader = {
            initialise: vi.fn().mockResolvedValue(undefined),
            loadMissingDocument: vi.fn().mockResolvedValue({}),
            resolvePath: vi.fn().mockReturnValue(undefined)
        };
        vi.spyOn(calmShared, 'buildDocumentLoader').mockReturnValue(mockDocLoader);

        // Mock buildDocumentLoader to return a mock DocumentLoader.
        // The generate command now uses buildDocumentLoader() which creates a
        // MultiStrategyDocumentLoader internally. We mock it to return a simple
        // loader whose loadMissingDocument resolves with an empty object.
        vi.spyOn(documentLoaderModule, 'buildDocumentLoader').mockReturnValue({
            initialise: vi.fn().mockResolvedValue(undefined),
            loadMissingDocument: vi.fn().mockResolvedValue({}),
            resolvePath: vi.fn().mockReturnValue(undefined),
        });

        const cliModule = await import('./cli');
        setupCLI = cliModule.setupCLI;

        program = new Command();
        setupCLI(program);
    });

    describe('Generate Command', () => {
        it('should call runGenerate with correct arguments', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'generate',
                '-p', 'pattern.json',
                '-o', 'output.json',
                '--verbose',
                '--schema-directory', 'schemas',
            ]);

            expect(mockDocLoader.loadMissingDocument).toHaveBeenCalledWith('pattern.json', 'pattern');
            expect(optionsModule.promptUserForOptions).toHaveBeenCalled();

            expect(calmShared.buildDocumentLoader).toHaveBeenCalledWith(expect.objectContaining({
                schemaDirectoryPath: 'schemas',
                debug: true,
                basePath: process.cwd()
            }));

            expect(calmShared.runGenerate).toHaveBeenCalledWith(
                {}, 'output.json', true, expect.any(calmShared.SchemaDirectory), []
            );
        });

        it('should use pre-defined choices and skip prompting when --option-choices is provided', async () => {
            const preDefinedChoices = [{ description: 'Use HTTP', nodes: ['node-a'], relationships: ['rel-a'] }];
            vi.spyOn(optionsModule, 'loadChoicesFromInput').mockReturnValue(preDefinedChoices);

            await program.parseAsync([
                'node', 'cli.js', 'generate',
                '-p', 'pattern.json',
                '-o', 'output.json',
                '--option-choices', '{"connection-options": "Use HTTP"}',
            ]);

            expect(optionsModule.loadChoicesFromInput).toHaveBeenCalledWith('{"connection-options": "Use HTTP"}', {}, false);
            expect(optionsModule.promptUserForOptions).not.toHaveBeenCalled();
            expect(calmShared.runGenerate).toHaveBeenCalledWith(
                {}, 'output.json', false, expect.any(calmShared.SchemaDirectory), preDefinedChoices
            );
        });
    });

    describe('Validate Command', () => {
        it('should call runValidate with correct options', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'validate',
                '-p', 'pattern.json',
                '-a', 'arch.json',
            ]);

            expect(validateModule.checkValidateOptions).toHaveBeenCalled();
            expect(validateModule.runValidate).toHaveBeenCalledWith(expect.objectContaining({
                patternPath: 'pattern.json',
                architecturePath: 'arch.json',
            }));
        });
    });

    describe('Diff Command', () => {
        it('should call runDiffCommand with correct options', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'diff',
                '-a', 'before.json',
                '-b', 'after.json',
                '--format', 'summary',
                '--exit-code',
            ]);

            expect(diffModule.runDiffCommand).toHaveBeenCalledWith(expect.objectContaining({
                documentAPath: 'before.json',
                documentBPath: 'after.json',
                outputFormat: 'summary',
            }));
        });

        it('should pass the document type through when --type is set', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'diff',
                '-a', 'before.pattern.json',
                '-b', 'after.pattern.json',
                '--type', 'pattern',
            ]);

            expect(diffModule.runDiffCommand).toHaveBeenCalledWith(expect.objectContaining({
                documentType: 'pattern',
            }));
        });

        it('should accept the deprecated --architecture-a/--architecture-b aliases', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'diff',
                '--architecture-a', 'before.json',
                '--architecture-b', 'after.json',
            ]);

            expect(diffModule.runDiffCommand).toHaveBeenCalledWith(expect.objectContaining({
                documentAPath: 'before.json',
                documentBPath: 'after.json',
            }));
        });

        it('should default to json format', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'diff',
                '-a', 'before.json',
                '-b', 'after.json',
            ]);

            expect(diffModule.runDiffCommand).toHaveBeenCalledWith(expect.objectContaining({
                outputFormat: 'json',
            }));
        });

        it('should exit 1 when --exit-code is set and runDiffCommand reports changes', async () => {
            vi.mocked(diffModule.runDiffCommand).mockResolvedValueOnce(true);
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(function () {
                throw new Error('process.exit called');
            });

            await expect(program.parseAsync([
                'node', 'cli.js', 'diff',
                '-a', 'before.json',
                '-b', 'after.json',
                '--exit-code',
            ])).rejects.toThrow('process.exit called');

            expect(exitSpy).toHaveBeenCalledWith(1);
            exitSpy.mockRestore();
        });

        it('should not exit when --exit-code is set but no changes were reported', async () => {
            vi.mocked(diffModule.runDiffCommand).mockResolvedValueOnce(false);
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

            await program.parseAsync([
                'node', 'cli.js', 'diff',
                '-a', 'before.json',
                '-b', 'after.json',
                '--exit-code',
            ]);

            expect(exitSpy).not.toHaveBeenCalled();
            exitSpy.mockRestore();
        });

        it('should not exit when changes are detected but --exit-code is not set', async () => {
            vi.mocked(diffModule.runDiffCommand).mockResolvedValueOnce(true);
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

            await program.parseAsync([
                'node', 'cli.js', 'diff',
                '-a', 'before.json',
                '-b', 'after.json',
            ]);

            expect(exitSpy).not.toHaveBeenCalled();
            exitSpy.mockRestore();
        });
    });

    describe('Template Command', () => {
        let processorConstructorSpy: MockInstance<(this: TemplateProcessor, inputPath: string, templateBundlePath: string, outputPath: string, urlToLocalPathMapping: Map<string, string>, mode?: TemplateProcessingMode) => TemplateProcessor>;

        beforeEach(() => {
            processorConstructorSpy = vi
                .spyOn(calmShared, 'TemplateProcessor')
                .mockImplementation(function () {
                    return {
                        processTemplate: vi.fn().mockResolvedValue(undefined),
                    } as unknown as TemplateProcessor; //This works to get round any but prob not spying properly (used in other tests)
                });
        });

        it('should handle --bundle mode correctly', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'template',
                '--architecture', 'model.json',
                '--bundle', 'templateDir',
                '--output', 'outDir',
                '--verbose',
            ]);

            expect(processorConstructorSpy).toHaveBeenCalledWith(
                'model.json',
                'templateDir',
                'outDir',
                expect.any(Map),
                'bundle',
                false,
                false
            );
        });

        it('should handle --template mode correctly', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'template',
                '--architecture', 'model.json',
                '--template', 'template.hbs',
                '--output', 'outDir',
            ]);

            expect(processorConstructorSpy).toHaveBeenCalledWith(
                'model.json',
                'template.hbs',
                'outDir',
                expect.any(Map),
                'template',
                false,
                false
            );
        });

        it('should handle --template-dir mode correctly', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'template',
                '--architecture', 'model.json',
                '--template-dir', 'templates/',
                '--output', 'outDir',
            ]);

            expect(processorConstructorSpy).toHaveBeenCalledWith(
                'model.json',
                'templates/',
                'outDir',
                expect.any(Map),
                'template-directory',
                false,
                false
            );
        });

        it('should honour --clear-output-directory', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'template',
                '--architecture', 'model.json',
                '--template-dir', 'templates/',
                '--output', 'outDir',
                '--clear-output-directory'
            ]);

            expect(processorConstructorSpy).toHaveBeenCalledWith(
                'model.json',
                'templates/',
                'outDir',
                expect.any(Map),
                'template-directory',
                false,
                true
            );
        });

        it('should exit if multiple template flags are provided', async () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(function () {
                throw new Error('process.exit called');
            });

            const errorSpy = vi.spyOn(console, 'error').mockImplementation(function () { });

            await expect(program.parseAsync([
                'node', 'cli.js', 'template',
                '--architecture', 'model.json',
                '--template', 't1.hbs',
                '--bundle', 'bundle',
                '--output', 'outDir'
            ])).rejects.toThrow('process.exit called');

            expect(errorSpy).toHaveBeenCalledWith('❌ Please specify exactly one of --template, --template-dir, or --bundle');
            expect(exitSpy).toHaveBeenCalledWith(1);

            exitSpy.mockRestore();
            errorSpy.mockRestore();
        });
    });


    describe('Docify Command', () => {
        let docifierConstructorSpy: MockInstance<
            (this: Docifier,
                mode: DocifyMode,
                inputPath: string,
                outputPath: string,
                urlMappingPath?: string,
                templateProcessingMode?: TemplateProcessingMode,
                templatePath?: string) => Docifier
        >;

        beforeEach(() => {
            docifierConstructorSpy = vi
                .spyOn(calmShared, 'Docifier')
                .mockImplementation(function () { return {
                    docify: vi.fn().mockResolvedValue(undefined),
                } as unknown as Docifier; });
        });

        it('should default to WEBSITE mode with bundle', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'WEBSITE',
                'model.json',
                'outDir',
                undefined,
                'bundle',
                undefined,
                false,
                false,
                undefined,
                undefined,
                undefined
            );
        });

        it('should honour --clear-output-directory', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--clear-output-directory'
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'WEBSITE',
                'model.json',
                'outDir',
                undefined,
                'bundle',
                undefined,
                true,
                false,
                undefined,
                undefined,
                undefined
            );
        });

        it('should use template mode if --template is specified', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--template', 'template.hbs',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'USER_PROVIDED',
                'model.json',
                'outDir',
                undefined,
                'template',
                'template.hbs',
                false,
                false,
                undefined,
                undefined,
                undefined
            );
        });

        it('should use template-directory mode if --template-dir is specified', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--template-dir', 'templateDir',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'USER_PROVIDED',
                'model.json',
                'outDir',
                undefined,
                'template-directory',
                'templateDir',
                false,
                false,
                undefined,
                undefined,
                undefined
            );
        });

        it('should exit if both --template and --template-dir are specified', async () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(function () {
                throw new Error('process.exit called');
            });
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(function () { });

            await expect(program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--template', 't1.hbs',
                '--template-dir', 'templateDir'
            ])).rejects.toThrow('process.exit called');

            expect(errorSpy).toHaveBeenCalledWith('❌ Please specify only one of --template or --template-dir');
            expect(exitSpy).toHaveBeenCalledWith(1);

            exitSpy.mockRestore();
            errorSpy.mockRestore();
        });

        it('should use WEBSITE mode by default', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'WEBSITE',
                'model.json',
                'outDir',
                undefined,
                'bundle',
                undefined,
                false,
                false,
                undefined,
                undefined,
                undefined
            );
        });

        it('should use USER_PROVIDED mode when --template is specified', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--template', 'template.hbs',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'USER_PROVIDED',
                'model.json',
                'outDir',
                undefined,
                'template',
                'template.hbs',
                false,
                false,
                undefined,
                undefined,
                undefined
            );
        });

        it('should not show --ants in help output', () => {
            const docifyCmd = program.commands.find(c => c.name() === 'docify');
            const helpText = docifyCmd!.helpInformation();
            expect(helpText).not.toContain('--ants');
        });

        it('should use ANTS mode when --ants is specified', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--ants',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'ANTS',
                'model.json',
                'outDir',
                undefined,
                'bundle',
                undefined,
                false,
                false,
                undefined,
                undefined,
                undefined
            );
        });

        it('should exit if --ants is combined with --template', async () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(function () {
                throw new Error('process.exit called');
            });
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(function () { });

            await expect(program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--ants',
                '--template', 'template.hbs',
            ])).rejects.toThrow('process.exit called');

            expect(errorSpy).toHaveBeenCalledWith('❌ --ants cannot be combined with --template or --template-dir');
            expect(exitSpy).toHaveBeenCalledWith(1);

            exitSpy.mockRestore();
            errorSpy.mockRestore();
        });

        it('should exit if --ants is combined with --template-dir', async () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(function () {
                throw new Error('process.exit called');
            });
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(function () { });

            await expect(program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--ants',
                '--template-dir', 'templateDir',
            ])).rejects.toThrow('process.exit called');

            expect(errorSpy).toHaveBeenCalledWith('❌ --ants cannot be combined with --template or --template-dir');
            expect(exitSpy).toHaveBeenCalledWith(1);

            exitSpy.mockRestore();
            errorSpy.mockRestore();
        });

        it('should exit if --export-diagrams is combined with --scaffold', async () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(function () {
                throw new Error('process.exit called');
            });
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(function () { });

            await expect(program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--scaffold',
                '--export-diagrams', 'svg',
            ])).rejects.toThrow('process.exit called');

            expect(errorSpy).toHaveBeenCalledWith('❌ --export-diagrams cannot be combined with --scaffold (scaffold output is unrendered)');
            expect(exitSpy).toHaveBeenCalledWith(1);

            exitSpy.mockRestore();
            errorSpy.mockRestore();
        });

        it('should pass --export-diagrams through to the Docifier', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--export-diagrams', 'svg',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'WEBSITE',
                'model.json',
                'outDir',
                undefined,
                'bundle',
                undefined,
                false,
                false,
                'svg',
                undefined,
                undefined
            );
        });

        it('should pass --export-diagrams and --browser-path through to the Docifier', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--export-diagrams', 'png',
                '--browser-path', '/path/to/chrome',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'WEBSITE',
                'model.json',
                'outDir',
                undefined,
                'bundle',
                undefined,
                false,
                false,
                'png',
                '/path/to/chrome',
                undefined
            );
        });

        it('should pass --diagram-render-timeout through to the Docifier', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--export-diagrams', 'svg',
                '--diagram-render-timeout', '30000',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'WEBSITE',
                'model.json',
                'outDir',
                undefined,
                'bundle',
                undefined,
                false,
                false,
                'svg',
                undefined,
                30000
            );
        });

        it('should exit if --diagram-render-timeout is specified without --export-diagrams', async () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(function () {
                throw new Error('process.exit called');
            });
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(function () { });

            await expect(program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--diagram-render-timeout', '30000',
            ])).rejects.toThrow('process.exit called');

            expect(errorSpy).toHaveBeenCalledWith('❌ --diagram-render-timeout requires --export-diagrams <svg|png>');
            expect(exitSpy).toHaveBeenCalledWith(1);

            exitSpy.mockRestore();
            errorSpy.mockRestore();
        });

        it('should exit if --diagram-render-timeout is not a positive number', async () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(function () {
                throw new Error('process.exit called');
            });
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(function () { });

            await expect(program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--export-diagrams', 'svg',
                '--diagram-render-timeout', '0',
            ])).rejects.toThrow('process.exit called');

            expect(errorSpy).toHaveBeenCalledWith('❌ --diagram-render-timeout must be a positive number of milliseconds');
            expect(exitSpy).toHaveBeenCalledWith(1);

            exitSpy.mockRestore();
            errorSpy.mockRestore();
        });

        it('should exit if --browser-path is specified without --export-diagrams', async () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(function () {
                throw new Error('process.exit called');
            });
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(function () { });

            await expect(program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--browser-path', '/path/to/chrome',
            ])).rejects.toThrow('process.exit called');

            expect(errorSpy).toHaveBeenCalledWith('❌ --browser-path requires --export-diagrams <svg|png>');
            expect(exitSpy).toHaveBeenCalledWith(1);

            exitSpy.mockRestore();
            errorSpy.mockRestore();
        });
    });

    describe('push architecture command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runPushArchitecture').mockResolvedValue(undefined);
        });

        it('calls runPushArchitecture with correct arguments', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'architecture',
                'arch.json',
                '--name', 'my-arch',
                '--calm-hub-url', 'http://hub',
            ]);

            // namespace is derived from the document $id, not a CLI option, so it is not passed here
            expect(hubCommandsModule.runPushArchitecture).toHaveBeenCalledWith(expect.objectContaining({
                file: 'arch.json',
                name: 'my-arch',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes the change type through for a versioned push', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'architecture',
                'arch.json',
                '--name', 'my-arch',
                '--calm-hub-url', 'http://hub',
                '--change-type', 'minor',
            ]);

            expect(hubCommandsModule.runPushArchitecture).toHaveBeenCalledWith(expect.objectContaining({
                changeType: 'MINOR',
            }));
        });

        it('defaults the change type to PATCH when not provided', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'architecture',
                'arch.json',
                '--name', 'my-arch',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPushArchitecture).toHaveBeenCalledWith(expect.objectContaining({
                changeType: 'PATCH',
            }));
        });

        it('passes --format pretty through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'architecture',
                'arch.json',
                '--name', 'my-arch',
                '--format', 'pretty',
            ]);

            expect(hubCommandsModule.runPushArchitecture).toHaveBeenCalledWith(expect.objectContaining({
                format: 'pretty',
            }));
        });

        it('rejects --format table', async () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(function () {
                throw new Error('process.exit called');
            });
            const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(function () { return true; });

            await expect(program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'architecture',
                'arch.json',
                '--name', 'my-arch',
                '--format', 'table',
            ])).rejects.toThrow('process.exit called');

            expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Allowed choices are json, pretty.'));
            expect(exitSpy).toHaveBeenCalledWith(1);

            exitSpy.mockRestore();
            stderrSpy.mockRestore();
        });
    });

    describe('pull architecture command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runPullArchitecture').mockResolvedValue(undefined);
        });

        it('calls runPullArchitecture with correct arguments', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'architecture',
                '--mapping', 'my-arch',
                '--namespace', 'finos',
                '--ver', '1.0.0',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPullArchitecture).toHaveBeenCalledWith(expect.objectContaining({
                mapping: 'my-arch',
                namespace: 'finos',
                version: '1.0.0',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --output when provided', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'architecture',
                '--mapping', 'my-arch',
                '--namespace', 'finos',
                '--ver', '1.0.0',
                '--calm-hub-url', 'http://hub',
                '--output', 'out.json',
            ]);

            expect(hubCommandsModule.runPullArchitecture).toHaveBeenCalledWith(expect.objectContaining({
                output: 'out.json',
            }));
        });
    });

    describe('list architectures command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runListArchitectures').mockResolvedValue(undefined);
        });

        it('calls runListArchitectures with namespace and hub url', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'architectures',
                '--namespace', 'finos',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListArchitectures).toHaveBeenCalledWith(expect.objectContaining({
                namespace: 'finos',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('defaults namespace to "default"', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'architectures',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListArchitectures).toHaveBeenCalledWith(expect.objectContaining({
                namespace: 'default',
            }));
        });

        it('passes --format pretty through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'architectures',
                '--format', 'pretty',
            ]);

            expect(hubCommandsModule.runListArchitectures).toHaveBeenCalledWith(expect.objectContaining({
                format: 'pretty',
            }));
        });
    });

    describe('list namespaces command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runListNamespaces').mockResolvedValue(undefined);
        });

        it('calls runListNamespaces with hub url', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'namespaces',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListNamespaces).toHaveBeenCalledWith(expect.objectContaining({
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --format pretty through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'namespaces',
                '--format', 'pretty',
            ]);

            expect(hubCommandsModule.runListNamespaces).toHaveBeenCalledWith(expect.objectContaining({
                format: 'pretty',
            }));
        });
    });

    describe('create namespace command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runCreateNamespace').mockResolvedValue(undefined);
        });

        it('calls runCreateNamespace with name and description', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'create', 'namespace',
                '--name', 'my-org',
                '--description', 'My organisation',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runCreateNamespace).toHaveBeenCalledWith(expect.objectContaining({
                name: 'my-org',
                description: 'My organisation',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --format pretty through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'create', 'namespace',
                '--name', 'my-org',
                '--description', 'My organisation',
                '--format', 'pretty',
            ]);

            expect(hubCommandsModule.runCreateNamespace).toHaveBeenCalledWith(expect.objectContaining({
                format: 'pretty',
            }));
        });
    });

    describe('create domain command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runCreateDomain').mockResolvedValue(undefined);
        });

        it('calls runCreateDomain with name and hub url', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'create', 'domain',
                '--name', 'risk',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runCreateDomain).toHaveBeenCalledWith(expect.objectContaining({
                name: 'risk',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --format pretty through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'create', 'domain',
                '--name', 'risk',
                '--format', 'pretty',
            ]);

            expect(hubCommandsModule.runCreateDomain).toHaveBeenCalledWith(expect.objectContaining({
                format: 'pretty',
            }));
        });
    });

    describe('list domains command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runListDomains').mockResolvedValue(undefined);
        });

        it('calls runListDomains with hub url', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'domains',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListDomains).toHaveBeenCalledWith(expect.objectContaining({
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --format pretty through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'domains',
                '--format', 'pretty',
            ]);

            expect(hubCommandsModule.runListDomains).toHaveBeenCalledWith(expect.objectContaining({
                format: 'pretty',
            }));
        });
    });

    describe('list controls command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runListControls').mockResolvedValue(undefined);
        });

        it('calls runListControls with domain and hub url', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'controls',
                '--domain', 'risk',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListControls).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --format pretty through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'controls',
                '--domain', 'risk',
                '--format', 'pretty',
            ]);

            expect(hubCommandsModule.runListControls).toHaveBeenCalledWith(expect.objectContaining({
                format: 'pretty',
            }));
        });
    });

    describe('push control-requirement command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runPushControlRequirement').mockResolvedValue(undefined);
        });

        it('calls runPushControlRequirement with the file and change type (addressing derived from $id)', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'control-requirement', 'req.json',
                '--change-type', 'minor',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPushControlRequirement).toHaveBeenCalledWith(expect.objectContaining({
                file: 'req.json',
                changeType: 'MINOR',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('defaults the change type to PATCH when not provided', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'control-requirement', 'req.json',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPushControlRequirement).toHaveBeenCalledWith(expect.objectContaining({
                file: 'req.json',
                changeType: 'PATCH',
            }));
        });
    });

    describe('pull control-requirement command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runPullControlRequirement').mockResolvedValue(undefined);
        });

        it('calls runPullControlRequirement with domain, control name and version', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'control-requirement',
                '--domain', 'risk',
                '--control-name', 'access-control',
                '--ver', '1.0.0',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPullControlRequirement).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                controlName: 'access-control',
                version: '1.0.0',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --output through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'control-requirement',
                '--domain', 'risk',
                '--control-name', 'access-control',
                '--ver', '1.0.0',
                '--output', 'out.json',
            ]);

            expect(hubCommandsModule.runPullControlRequirement).toHaveBeenCalledWith(expect.objectContaining({
                output: 'out.json',
            }));
        });
    });

    describe('push control-configuration command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runPushControlConfiguration').mockResolvedValue(undefined);
        });

        it('calls runPushControlConfiguration with the file and change type (addressing derived from $id)', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'control-configuration', 'cfg.json',
                '--change-type', 'minor',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPushControlConfiguration).toHaveBeenCalledWith(expect.objectContaining({
                file: 'cfg.json',
                changeType: 'MINOR',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });
    });

    describe('pull control-configuration command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runPullControlConfiguration').mockResolvedValue(undefined);
        });

        it('calls runPullControlConfiguration with domain, control name, config name and version', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'control-configuration',
                '--domain', 'risk',
                '--control-name', 'access-control',
                '--config-name', 'prod',
                '--ver', '1.0.0',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPullControlConfiguration).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                controlName: 'access-control',
                configName: 'prod',
                version: '1.0.0',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --output through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'control-configuration',
                '--domain', 'risk',
                '--control-name', 'access-control',
                '--config-name', 'prod',
                '--ver', '1.0.0',
                '--output', 'out.json',
            ]);

            expect(hubCommandsModule.runPullControlConfiguration).toHaveBeenCalledWith(expect.objectContaining({
                output: 'out.json',
            }));
        });
    });

    describe('list control-configurations command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runListControlConfigurations').mockResolvedValue(undefined);
        });

        it('calls runListControlConfigurations with domain and control name', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'control-configurations',
                '--domain', 'risk',
                '--control-name', 'access-control',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListControlConfigurations).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                controlName: 'access-control',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --format pretty through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'control-configurations',
                '--domain', 'risk',
                '--control-name', 'access-control',
                '--format', 'pretty',
            ]);

            expect(hubCommandsModule.runListControlConfigurations).toHaveBeenCalledWith(expect.objectContaining({
                format: 'pretty',
            }));
        });

    });

    describe('push pattern command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runPushPattern').mockResolvedValue(undefined);
        });

        it('calls runPushPattern with file and hub url', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'pattern', 'pattern.json',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPushPattern).toHaveBeenCalledWith(expect.objectContaining({
                file: 'pattern.json',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes the change type through for a versioned push', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'pattern', 'pattern.json',
                '--change-type', 'major',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPushPattern).toHaveBeenCalledWith(expect.objectContaining({
                changeType: 'MAJOR',
            }));
        });

        it('defaults the change type to PATCH when not provided', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'pattern', 'pattern.json',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPushPattern).toHaveBeenCalledWith(expect.objectContaining({
                changeType: 'PATCH',
            }));
        });
    });

    describe('pull pattern command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runPullPattern').mockResolvedValue(undefined);
        });

        it('calls runPullPattern with namespace, mapping, version and hub url', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'pattern',
                '--namespace', 'finos',
                '--mapping', 'my-pattern',
                '--ver', '1.0.0',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPullPattern).toHaveBeenCalledWith(expect.objectContaining({
                namespace: 'finos',
                mapping: 'my-pattern',
                version: '1.0.0',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --output when provided', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'pattern',
                '--namespace', 'finos',
                '--mapping', 'my-pattern',
                '--output', 'out.json',
            ]);

            expect(hubCommandsModule.runPullPattern).toHaveBeenCalledWith(expect.objectContaining({
                output: 'out.json',
            }));
        });
    });

    describe('push standard command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runPushStandard').mockResolvedValue(undefined);
        });

        it('calls runPushStandard with file and hub url', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'standard', 'standard.json',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPushStandard).toHaveBeenCalledWith(expect.objectContaining({
                file: 'standard.json',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes the change type through for a versioned push', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'standard', 'standard.json',
                '--change-type', 'minor',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPushStandard).toHaveBeenCalledWith(expect.objectContaining({
                changeType: 'MINOR',
            }));
        });

        it('defaults the change type to PATCH when not provided', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'standard', 'standard.json',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPushStandard).toHaveBeenCalledWith(expect.objectContaining({
                changeType: 'PATCH',
            }));
        });
    });

    describe('pull standard command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runPullStandard').mockResolvedValue(undefined);
        });

        it('calls runPullStandard with namespace, mapping, version and hub url', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'standard',
                '--namespace', 'finos',
                '--mapping', 'my-standard',
                '--ver', '2.0.0',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPullStandard).toHaveBeenCalledWith(expect.objectContaining({
                namespace: 'finos',
                mapping: 'my-standard',
                version: '2.0.0',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --output when provided', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'standard',
                '--namespace', 'finos',
                '--mapping', 'my-standard',
                '--output', 'out.json',
            ]);

            expect(hubCommandsModule.runPullStandard).toHaveBeenCalledWith(expect.objectContaining({
                output: 'out.json',
            }));
        });
    });

    describe('list patterns command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runListPatterns').mockResolvedValue(undefined);
        });

        it('calls runListPatterns with namespace and hub url', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'patterns',
                '--namespace', 'finos',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListPatterns).toHaveBeenCalledWith(expect.objectContaining({
                namespace: 'finos',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('defaults namespace to "default"', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'patterns',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListPatterns).toHaveBeenCalledWith(expect.objectContaining({
                namespace: 'default',
            }));
        });
    });

    describe('list standards command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runListStandards').mockResolvedValue(undefined);
        });

        it('calls runListStandards with namespace and hub url', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'standards',
                '--namespace', 'finos',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListStandards).toHaveBeenCalledWith(expect.objectContaining({
                namespace: 'finos',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('defaults namespace to "default"', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'standards',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListStandards).toHaveBeenCalledWith(expect.objectContaining({
                namespace: 'default',
            }));
        });
    });

});

describe('parseDocumentLoaderConfig', () => {
    const parseDocLoaderConfigForTest = async (options: {
        verbose?: boolean;
        calmHubUrl?: string;
        schemaDirectory?: string;
        allowedRemoteHosts?: string[];
    }) => {
        const cliModule = await import('./cli');
        return cliModule.parseDocumentLoaderConfig(options);
    };

    it('should parse calmhub url when provided', async () => {
        const options = await parseDocLoaderConfigForTest({
            calmHubUrl: 'calmhub'
        });
        expect(options.calmHubUrl).toEqual('calmhub');
    });

    it('should override calmhub url in file when provided', async () => {
        cliConfigModule = await import('./cli-config');
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({ calmHubUrl: 'calmhub-file' });

        const options = await parseDocLoaderConfigForTest({
            calmHubUrl: 'calmhub-cli'
        });
        expect(options.calmHubUrl).toEqual('calmhub-cli');
    });

    it('should parse schemaDirectoryPath when provided', async () => {
        const options = await parseDocLoaderConfigForTest({
            schemaDirectory: 'path'
        });
        expect(options.schemaDirectoryPath).toEqual('path');
    });

    it('should parse allowedRemoteHosts when provided', async () => {
        const options = await parseDocLoaderConfigForTest({
            allowedRemoteHosts: ['schemas.example.com']
        });
        expect(options.allowedRemoteHosts).toEqual(['schemas.example.com']);
    });

    it('should use allowedRemoteHosts from config when CLI does not provide them', async () => {
        cliConfigModule = await import('./cli-config');
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({
            allowedRemoteHosts: ['config.example.com']
        });

        const options = await parseDocLoaderConfigForTest({});
        expect(options.allowedRemoteHosts).toEqual(['config.example.com']);
    });

    it('should prefer CLI allowedRemoteHosts over config values', async () => {
        cliConfigModule = await import('./cli-config');
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({
            allowedRemoteHosts: ['config.example.com']
        });

        const options = await parseDocLoaderConfigForTest({
            allowedRemoteHosts: ['cli.example.com']
        });
        expect(options.allowedRemoteHosts).toEqual(['cli.example.com']);
    });

    it('should set debug to true when verbose passed along', async () => {
        const options = await parseDocLoaderConfigForTest({
            verbose: true
        });
        expect(options.debug).toBeTruthy();
    });

    it('should default debug to false', async () => {
        const options = await parseDocLoaderConfigForTest({
        });
        expect(options.debug).toBeFalsy();
    });

    it('loads auth plugin from config file when authPluginPath is set', async () => {
        cliConfigModule = await import('./cli-config');
        const fakePlugin = { getAuthHeader: vi.fn() };
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({ authPluginPath: '/fake/plugin.js' });
        vi.spyOn(cliConfigModule, 'loadAuthPlugin').mockResolvedValue(fakePlugin as never);

        const options = await parseDocLoaderConfigForTest({});

        expect(cliConfigModule.loadAuthPlugin).toHaveBeenCalledWith('/fake/plugin.js', false);
        expect(options.authPlugin).toBe(fakePlugin);
    });

    it('logs an error and continues when auth plugin loading throws', async () => {
        cliConfigModule = await import('./cli-config');
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({ authPluginPath: '/bad/plugin.js' });
        vi.spyOn(cliConfigModule, 'loadAuthPlugin').mockRejectedValue(new Error('module not found'));

        const options = await parseDocLoaderConfigForTest({});

        expect(options.authPlugin).toBeUndefined();
    });
});
