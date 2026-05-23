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
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(() => {
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
                .mockImplementation(() => {
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
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(() => {
                throw new Error('process.exit called');
            });

            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

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
                .mockImplementation(() => ({
                    docify: vi.fn().mockResolvedValue(undefined),
                } as unknown as Docifier));
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
                false
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
                false
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
                false
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
                false
            );
        });

        it('should exit if both --template and --template-dir are specified', async () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(() => {
                throw new Error('process.exit called');
            });
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

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
                false
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
                false
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
                false
            );
        });

        it('should exit if --ants is combined with --template', async () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(() => {
                throw new Error('process.exit called');
            });
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

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
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(() => {
                throw new Error('process.exit called');
            });
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

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
                '--namespace', 'finos',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPushArchitecture).toHaveBeenCalledWith(expect.objectContaining({
                file: 'arch.json',
                name: 'my-arch',
                namespace: 'finos',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --id and --version for versioned push', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'architecture',
                'arch.json',
                '--name', 'my-arch',
                '--namespace', 'finos',
                '--calm-hub-url', 'http://hub',
                '--id', '42',
                '--ver', '2.0.0',
            ]);

            expect(hubCommandsModule.runPushArchitecture).toHaveBeenCalledWith(expect.objectContaining({
                id: '42',
                version: '2.0.0',
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
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(() => {
                throw new Error('process.exit called');
            });
            const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

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
                '--id', '1',
                '--namespace', 'finos',
                '--ver', '1.0.0',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPullArchitecture).toHaveBeenCalledWith(expect.objectContaining({
                id: '1',
                namespace: 'finos',
                version: '1.0.0',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --output when provided', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'architecture',
                '--id', '1',
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

    describe('create control-requirement command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runCreateControlRequirement').mockResolvedValue(undefined);
        });

        it('calls runCreateControlRequirement with domain, name, description and file', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'create', 'control-requirement', 'req.json',
                '--domain', 'risk',
                '--name', 'my-control',
                '--description', 'A control',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runCreateControlRequirement).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                name: 'my-control',
                description: 'A control',
                file: 'req.json',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
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

    describe('list control-requirements command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runListControlRequirements').mockResolvedValue(undefined);
        });

        it('calls runListControlRequirements with domain and hub url', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'control-requirements',
                '--domain', 'risk',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListControlRequirements).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --format pretty through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'control-requirements',
                '--domain', 'risk',
                '--format', 'pretty',
            ]);

            expect(hubCommandsModule.runListControlRequirements).toHaveBeenCalledWith(expect.objectContaining({
                format: 'pretty',
            }));
        });
    });

    describe('push control-requirement command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runPushControlRequirement').mockResolvedValue(undefined);
        });

        it('calls runPushControlRequirement with domain, controlId, version and file', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'control-requirement', 'req.json',
                '--domain', 'risk',
                '--control-id', '1',
                '--ver', '1.0.0',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPushControlRequirement).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                file: 'req.json',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });
    });

    describe('pull control-requirement command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runPullControlRequirement').mockResolvedValue(undefined);
        });

        it('calls runPullControlRequirement with domain, controlId and version', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'control-requirement',
                '--domain', 'risk',
                '--control-id', '1',
                '--ver', '1.0.0',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPullControlRequirement).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --output through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'control-requirement',
                '--domain', 'risk',
                '--control-id', '1',
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

        it('calls runPushControlConfiguration with domain, controlId, configId, version and file', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'push', 'control-configuration', 'cfg.json',
                '--domain', 'risk',
                '--control-id', '1',
                '--config-id', 'cfg-1',
                '--ver', '1.0.0',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPushControlConfiguration).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                controlId: '1',
                configId: 'cfg-1',
                version: '1.0.0',
                file: 'cfg.json',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });
    });

    describe('pull control-configuration command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runPullControlConfiguration').mockResolvedValue(undefined);
        });

        it('calls runPullControlConfiguration with domain, controlId, configId and version', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'control-configuration',
                '--domain', 'risk',
                '--control-id', '1',
                '--config-id', 'cfg-1',
                '--ver', '1.0.0',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runPullControlConfiguration).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                controlId: '1',
                configId: 'cfg-1',
                version: '1.0.0',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --output through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'pull', 'control-configuration',
                '--domain', 'risk',
                '--control-id', '1',
                '--config-id', 'cfg-1',
                '--ver', '1.0.0',
                '--output', 'out.json',
            ]);

            expect(hubCommandsModule.runPullControlConfiguration).toHaveBeenCalledWith(expect.objectContaining({
                output: 'out.json',
            }));
        });
    });

    describe('create control-configuration command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runCreateControlConfiguration').mockResolvedValue(undefined);
        });

        it('calls runCreateControlConfiguration with domain, controlId and file', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'create', 'control-configuration', 'cfg.json',
                '--domain', 'risk',
                '--control-id', '1',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runCreateControlConfiguration).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                controlId: '1',
                file: 'cfg.json',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });
    });

    describe('list control-configurations command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runListControlConfigurations').mockResolvedValue(undefined);
        });

        it('calls runListControlConfigurations with domain and controlId', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'control-configurations',
                '--domain', 'risk',
                '--control-id', '1',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListControlConfigurations).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                controlId: '1',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });

        it('passes --format pretty through to the handler', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'control-configurations',
                '--domain', 'risk',
                '--control-id', '1',
                '--format', 'pretty',
            ]);

            expect(hubCommandsModule.runListControlConfigurations).toHaveBeenCalledWith(expect.objectContaining({
                format: 'pretty',
            }));
        });
    });

    describe('list control-requirement-versions command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runListControlRequirementVersions').mockResolvedValue(undefined);
        });

        it('calls runListControlRequirementVersions with domain and controlId', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'control-requirement-versions',
                '--domain', 'risk',
                '--control-id', '1',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListControlRequirementVersions).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                controlId: '1',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
            }));
        });
    });

    describe('list control-configuration-versions command', () => {
        beforeEach(async () => {
            hubCommandsModule = await import('./command-helpers/hub-commands');
            vi.spyOn(hubCommandsModule, 'runListControlConfigurationVersions').mockResolvedValue(undefined);
        });

        it('calls runListControlConfigurationVersions with domain, controlId and configId', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'hub', 'list', 'control-configuration-versions',
                '--domain', 'risk',
                '--control-id', '1',
                '--config-id', '5',
                '--calm-hub-url', 'http://hub',
            ]);

            expect(hubCommandsModule.runListControlConfigurationVersions).toHaveBeenCalledWith(expect.objectContaining({
                domain: 'risk',
                controlId: '1',
                configId: '5',
                calmHubOptions: expect.objectContaining({ calmHubUrl: 'http://hub' }),
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
});
