import { CALM_META_SCHEMA_DIRECTORY, DocifyMode, DiagramExportFormat, initLogger, runGenerate, SchemaDirectory, TemplateProcessingMode, CalmChoice, buildDocumentLoader, DocumentLoader, DocumentLoaderOptions } from '@finos/calm-shared';
import { Option, Command } from 'commander';
import { version } from '../package.json';
import { promptUserForOptions, loadChoicesFromInput } from './command-helpers/generate-options';
import * as cliConfig from './cli-config';
import path from 'path';
import { select } from '@inquirer/prompts';
import {
    CreateNamespaceOptions,
    ListNamespacesOptions,
    PushOptions,
    PullOptions,
    runCreateNamespace,
    runListArchitectures,
    runListNamespaces,
    runListPatterns,
    runListStandards,
    runPullArchitecture,
    runPullPattern,
    runPullStandard,
    runPushArchitecture,
    runPushPattern,
    runPushStandard,
    CreateDomainOptions,
    ListDomainsOptions,
    PushControlOptions,
    PullControlOptions,
    ListControlsOptions,
    ListControlConfigurationsOptions,
    runCreateDomain,
    runListDomains,
    runPushControlRequirement,
    runPullControlRequirement,
    runPushControlConfiguration,
    runPullControlConfiguration,
    runListControls,
    runListControlConfigurations,
    ListOptions,
} from './command-helpers/hub-commands';
import type { ResourceChangeType } from '@finos/calm-shared';

// Shared options used across multiple commands
const ARCHITECTURE_OPTION = '-a, --architecture <file>';
const OUTPUT_OPTION = '-o, --output <file>';
const SCHEMAS_OPTION = '-s, --schema-directory <path>';
const TIMELINE_OPTION = '--timeline <file>';
const VERBOSE_OPTION = '-v, --verbose';

// Generate command options
const PATTERN_OPTION = '-p, --pattern <file>';
const CALMHUB_URL_OPTION = '-c, --calm-hub-url <url>';
const OPTION_CHOICES_OPTION = '--option-choices <choices>';

// Validate command options
const FORMAT_OPTION = '-f, --format <format>';
const STRICT_OPTION = '--strict';

// Template and Docify command options
const BUNDLE_OPTION = '-b, --bundle <path>';
const TEMPLATE_OPTION = '-t, --template <path>';
const TEMPLATE_DIR_OPTION = '-d, --template-dir <path>';
const URL_MAPPING_OPTION = '-u, --url-to-local-file-mapping <path>';
const CLEAR_OUTPUT_DIRECTORY_OPTION = '--clear-output-directory';

// init-ai command options
const AI_DIRECTORY_OPTION = '-d, --directory <path>';
const AI_PROVIDER_OPTION = '-p, --provider <provider>';
const AI_PROVIDER_CHOICES = ['copilot', 'kiro', 'claude', 'codex'];

// Hub command options
const NAMESPACE_OPTION = '--namespace <namespace>';
const NAME_OPTION = '--name <name>';
const DESCRIPTION_OPTION = '--description <description>';
const HUB_VERSION_OPTION = '--ver <version>'; // --version conflicts with Commander's built-in version flag
const DOMAIN_OPTION = '--domain <domain>';
const CONTROL_NAME_OPTION = '--control-name <controlName>';
const CONFIG_NAME_OPTION = '--config-name <configName>';
const MAPPING_OPTION = '-m, --mapping <mapping>';

export function setupCLI(program: Command) {
    program
        .name('calm')
        .version(version)
        .description('A set of tools for interacting with the Common Architecture Language Model (CALM)');

    program
        .command('generate')
        .description('Generate an architecture from a CALM pattern file.')
        .requiredOption(PATTERN_OPTION, 'Path to the pattern file to use. May be a file path or a CalmHub URL.')
        .requiredOption(OUTPUT_OPTION, 'Path location at which to output the generated file.', 'architecture.json')
        .option(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .option(URL_MAPPING_OPTION, 'Path to mapping file which maps URLs to local paths')
        .option(OPTION_CHOICES_OPTION, 'Pre-defined option choices as a JSON object mapping option unique-ids to choice descriptions, or a path to a JSON file. Skips interactive prompts.')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const debug = !!options.verbose;
            const { getUrlToLocalFileMap } = await import('./command-helpers/template');
            const urlToLocalMap = getUrlToLocalFileMap(options.urlToLocalFileMapping);
            const patternBasePath = options.pattern ? path.dirname(path.resolve(options.pattern)) : undefined;
            const docLoaderOpts = await parseDocumentLoaderConfig(options, urlToLocalMap, patternBasePath);
            const docLoader = buildDocumentLoader(docLoaderOpts);
            const schemaDirectory = await buildSchemaDirectory(docLoader, debug);
            const pattern: object = await docLoader.loadMissingDocument(options.pattern, 'pattern');
            const choices: CalmChoice[] = options.optionChoices
                ? loadChoicesFromInput(options.optionChoices, pattern, debug)
                : await promptUserForOptions(pattern, options.verbose);
            await runGenerate(pattern, options.output, debug, schemaDirectory, choices);
        });

    program
        .command('validate')
        .description('Validate a CALM document.')
        .addHelpText('after', `

Validation requires:
  - an architecture:             to validate against CALM schema
  - an architecture and pattern: to validate the architecture against the CALM pattern
  - a pattern:                   to validate the pattern against CALM schema
  - a timeline:                  to validate the timeline against CALM timeline schema`)
        .option(PATTERN_OPTION, 'Path to the pattern file to use. May be a file path or a URL.')
        .option(ARCHITECTURE_OPTION, 'Path to the architecture file to use. May be a file path or a URL.')
        .option(TIMELINE_OPTION, 'Path to the timeline file to validate. May be a file path or a URL.')
        .option(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.', CALM_META_SCHEMA_DIRECTORY)
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .option(URL_MAPPING_OPTION, 'Path to mapping file which maps URLs to local paths')
        .option(STRICT_OPTION, 'When run in strict mode, the CLI will fail if any warnings are reported.', false)
        .addOption(
            new Option(FORMAT_OPTION, 'The format of the output')
                .choices(['json', 'junit', 'pretty'])
                .default('json')
        )
        .option(OUTPUT_OPTION, 'Path location at which to output the generated file.')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const { checkValidateOptions, runValidate } = await import('./command-helpers/validate');
            checkValidateOptions(program, options, PATTERN_OPTION, ARCHITECTURE_OPTION, TIMELINE_OPTION);
            await runValidate({
                architecturePath: options.architecture,
                patternPath: options.pattern,
                timelinePath: options.timeline,
                metaSchemaPath: options.schemaDirectory,
                calmHubUrl: options.calmHubUrl,
                urlToLocalFileMapping: options.urlToLocalFileMapping,
                verbose: !!options.verbose,
                strict: options.strict,
                outputFormat: options.format,
                outputPath: options.output
            });
        });

    program
        .command('template')
        .description('Generate files from a CALM model using a template bundle, a single file, or a directory of templates')
        .requiredOption(ARCHITECTURE_OPTION, 'Path to the CALM architecture JSON file')
        .requiredOption(OUTPUT_OPTION, 'Path to output directory or file')
        .option(CLEAR_OUTPUT_DIRECTORY_OPTION, 'Clear the output directory before processing', false)
        .option(BUNDLE_OPTION, 'Path to the template bundle directory')
        .option(TEMPLATE_OPTION, 'Path to a single .hbs or .md template file')
        .option(TEMPLATE_DIR_OPTION, 'Path to a directory of .hbs/.md templates')
        .option(URL_MAPPING_OPTION, 'Path to mapping file which maps URLs to local paths')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const { getUrlToLocalFileMap } = await import('./command-helpers/template');
            const { TemplateProcessor } = await import('@finos/calm-shared');
            if (options.verbose) {
                process.env.DEBUG = 'true';
            }
            const localDirectory = getUrlToLocalFileMap(options.urlToLocalFileMapping);
            let mode: TemplateProcessingMode;
            let templatePath: string;

            const flagsUsed = [options.template, options.templateDir, options.bundle].filter(Boolean);

            if (flagsUsed.length !== 1) {
                console.error('❌ Please specify exactly one of --template, --template-dir, or --bundle');
                process.exit(1);
            }

            if (options.template) {
                templatePath = options.template;
                mode = 'template';
            } else if (options.templateDir) {
                templatePath = options.templateDir;
                mode = 'template-directory';
            } else {
                templatePath = options.bundle;
                mode = 'bundle';
            }

            const processor = new TemplateProcessor(
                options.architecture,
                templatePath,
                options.output,
                localDirectory,
                mode,
                false,
                options.clearOutputDirectory
            );

            await processor.processTemplate();
        });

    program
        .command('docify')
        .description('Generate a documentation website from your CALM model using a template or template directory')
        .requiredOption(ARCHITECTURE_OPTION, 'Path to the CALM architecture JSON file')
        .requiredOption(OUTPUT_OPTION, 'Path to output directory')
        .option(CLEAR_OUTPUT_DIRECTORY_OPTION, 'Clear the output directory before processing', false)
        .option(TEMPLATE_OPTION, 'Path to a single .hbs or .md template file')
        .option(TEMPLATE_DIR_OPTION, 'Path to a directory of .hbs/.md templates')
        .option(URL_MAPPING_OPTION, 'Path to mapping file which maps URLs to local paths')
        .option('--scaffold', 'Copy template files without processing (for customization/live docify)', false)
        .addOption(new Option('--ants').default(false).hideHelp())
        .addOption(new Option('--export-diagrams <format>',
            'Render mermaid diagrams to image files using a local Chromium-based browser ' +
            '(adds roughly 10-40s depending on diagram count)').choices(['svg', 'png']))
        .option('--browser-path <path>',
            'Path to a Chromium-based browser executable, only needed if automatic detection fails (run with --export-diagrams to see guidance)')
        .option('--diagram-render-timeout <ms>',
            'Per-diagram render timeout in milliseconds, only used with --export-diagrams (default: 30000). ' +
            'Increase this for large/complex diagrams that time out during rendering.')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const { Docifier } = await import('@finos/calm-shared');

            if (options.verbose) {
                process.env.DEBUG = 'true';
            }

            const flagsUsed = [options.template, options.templateDir].filter(Boolean);

            if (flagsUsed.length > 1) {
                console.error('❌ Please specify only one of --template or --template-dir');
                process.exit(1);
            }

            if (options.ants && flagsUsed.length > 0) {
                console.error('❌ --ants cannot be combined with --template or --template-dir');
                process.exit(1);
            }

            if (options.exportDiagrams && options.scaffold) {
                console.error('❌ --export-diagrams cannot be combined with --scaffold (scaffold output is unrendered)');
                process.exit(1);
            }

            if (options.browserPath && !options.exportDiagrams) {
                console.error('❌ --browser-path requires --export-diagrams <svg|png>');
                process.exit(1);
            }

            if (options.diagramRenderTimeout && !options.exportDiagrams) {
                console.error('❌ --diagram-render-timeout requires --export-diagrams <svg|png>');
                process.exit(1);
            }

            let diagramRenderTimeoutMs: number | undefined;
            if (options.diagramRenderTimeout) {
                diagramRenderTimeoutMs = Number(options.diagramRenderTimeout);
                if (!Number.isFinite(diagramRenderTimeoutMs) || diagramRenderTimeoutMs <= 0) {
                    console.error('❌ --diagram-render-timeout must be a positive number of milliseconds');
                    process.exit(1);
                }
            }

            let docifyMode: DocifyMode = 'WEBSITE';
            let templateProcessingMode: TemplateProcessingMode = 'bundle';
            let templatePath: string | undefined = undefined;

            if (options.ants) {
                docifyMode = 'ANTS';
            } else if (options.template) {
                docifyMode = 'USER_PROVIDED';
                templateProcessingMode = 'template';
                templatePath = options.template;
            } else if (options.templateDir) {
                docifyMode = 'USER_PROVIDED';
                templateProcessingMode = 'template-directory';
                templatePath = options.templateDir;
            }

            const docifier = new Docifier(
                docifyMode,
                options.architecture,
                options.output,
                options.urlToLocalFileMapping,
                templateProcessingMode,
                templatePath,
                options.clearOutputDirectory,
                options.scaffold,
                options.exportDiagrams as DiagramExportFormat | undefined,
                options.browserPath,
                diagramRenderTimeoutMs
            );

            await docifier.docify();
        });

    const providerOption = new Option(AI_PROVIDER_OPTION, 'AI provider to initialize')
        .choices(AI_PROVIDER_CHOICES);

    program
        .command('init-ai')
        .description('Augment a git repository with AI assistance for CALM')
        .addOption(providerOption)
        .option(AI_DIRECTORY_OPTION, 'Target directory (defaults to current directory)', '.')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const { setupAiTools } = await import('./command-helpers/ai-tools');
            const providers = AI_PROVIDER_CHOICES;
            let selectedProvider: string = options.provider;
            if (!selectedProvider) {
                selectedProvider = await select({
                    message: 'Select an AI provider:',
                    choices: providers.map((p: string) => ({ name: p, value: p })),
                });
            }
            console.log(`Selected AI provider: ${selectedProvider}`);

            await setupAiTools(selectedProvider, options.directory, !!options.verbose);
        });

    program
        .command('diff')
        .description('Compare two CALM documents (architectures or patterns), or the moments of a CALM timeline, and report what changed.')
        .addHelpText('after', `

Diff modes:
  - two documents:  diff -a <doc-a> -b <doc-b>
  - a timeline:     diff --timeline <file>                       (diffs every adjacent moment pair)
  - timeline pair:  diff --timeline <file> --from <id> --to <id> (diffs any two moments)

Timeline moment 'detailed-architecture' references are resolved relative to the timeline file's directory.`)
        .option('-a, --document-a <file>', 'Path to the first (baseline) CALM document.')
        .option('-b, --document-b <file>', 'Path to the second CALM document to compare against the baseline.')
        .option(TIMELINE_OPTION, 'Path to a CALM timeline file. Diffs adjacent moments, or a specific pair with --from/--to.')
        .option('--from <momentId>', 'With --timeline, the unique-id of the baseline moment (requires --to).')
        .option('--to <momentId>', 'With --timeline, the unique-id of the moment to compare against (requires --from).')
        // Deprecated aliases retained for backwards compatibility with cli-v1.41.0,
        // which shipped the diff command with architecture-only long flags.
        .addOption(new Option('--architecture-a <file>', 'Deprecated alias for --document-a.').hideHelp())
        .addOption(new Option('--architecture-b <file>', 'Deprecated alias for --document-b.').hideHelp())
        .addOption(
            new Option('-f, --format <format>', 'Output format')
                .choices(['json', 'summary'])
                .default('json')
        )
        .addOption(
            new Option('-t, --type <type>', 'Force the document type instead of auto-detecting it.')
                .choices(['architecture', 'pattern'])
        )
        .option(OUTPUT_OPTION, 'Path location at which to write the diff output. If omitted, prints to stdout.')
        .option('--exit-code', 'Exit with a non-zero status code when changes are detected. Useful in CI to gate version bumps.', false)
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options, command) => {
            if (options.timeline) {
                const documentAPath = options.documentA ?? options.architectureA;
                const documentBPath = options.documentB ?? options.architectureB;
                if (documentAPath || documentBPath) {
                    command.error('error: --timeline cannot be combined with -a/--document-a or -b/--document-b');
                }
                if ((options.from && !options.to) || (!options.from && options.to)) {
                    command.error('error: --from and --to must be supplied together');
                }
                const { runTimelineDiffCommand } = await import('./command-helpers/diff');
                const hasChanges = await runTimelineDiffCommand({
                    timelinePath: options.timeline,
                    fromMomentId: options.from,
                    toMomentId: options.to,
                    outputFormat: options.format,
                    outputPath: options.output,
                    verbose: !!options.verbose,
                });
                if (options.exitCode && hasChanges) {
                    process.exit(1);
                }
                return;
            }

            if (options.from || options.to) {
                command.error('error: --from/--to are only valid together with --timeline');
            }

            const documentAPath = options.documentA ?? options.architectureA;
            const documentBPath = options.documentB ?? options.architectureB;
            if (!documentAPath || !documentBPath) {
                command.error('error: both -a/--document-a <file> and -b/--document-b <file> are required');
            }
            if (options.architectureA || options.architectureB) {
                process.stderr.write('warning: --architecture-a/--architecture-b are deprecated; use --document-a/--document-b.\n');
            }
            const { runDiffCommand } = await import('./command-helpers/diff');
            const hasChanges = await runDiffCommand({
                documentAPath,
                documentBPath,
                outputFormat: options.format,
                outputPath: options.output,
                documentType: options.type,
                verbose: !!options.verbose,
            });
            if (options.exitCode && hasChanges) {
                process.exit(1);
            }
        });

    program
        .command('timeline')
        .description('Synthesise an implied CALM timeline from a set of local versioned architecture files.')
        .addHelpText('after', `

One moment is generated per input architecture, in the order the files are given
(plain files have no semver versions to sort by). Each moment's name/description
is taken from the architecture's own name/description when present, else derived
from the filename. The 'detailed-architecture' reference is written relative to
the --output file's directory so the timeline is portable and reloadable by
'calm validate --timeline' / 'calm diff --timeline'.

Example:
  calm timeline -a v1.json -a v2.json -a v3.json -o calm-timeline.json`)
        .requiredOption('-a, --architecture <files...>', 'Paths to architecture files, in moment order. Repeat the flag or pass several paths after one flag.')
        .option(OUTPUT_OPTION, 'Path location at which to write the generated timeline. If omitted, prints to stdout.')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const { runTimelineGenerate } = await import('./command-helpers/timeline');
            runTimelineGenerate({
                architecturePaths: options.architecture,
                outputPath: options.output,
                verbose: !!options.verbose,
            });
        });

    program
        .command('init-config')
        .description('Create or update the CALM CLI configuration file (~/.calm.json).')
        .option('--allowed-remote-hosts <hosts>', 'Comma-separated list of trusted remote hosts to allow for direct URL loading')
        .option('--calm-hub-url <url>', 'URL to a trusted file location (e.g. CALMHub) to allow for direct URL loading of CALM documents')
        .action(async (options) => {
            const existingConfig = await cliConfig.loadCliConfig() ?? {};

            if (options.allowedRemoteHosts) {
                const newHosts = (options.allowedRemoteHosts as string).split(',').map((h: string) => h.trim()).filter(Boolean);
                const existingHosts = existingConfig.allowedRemoteHosts ?? [];
                const merged = [...new Set([...existingHosts, ...newHosts])];
                existingConfig.allowedRemoteHosts = merged;
            }

            if (options.calmHubUrl) {
                existingConfig.calmHubUrl = options.calmHubUrl;
            }

            const configPath = cliConfig.getUserConfigLocation();
            await cliConfig.saveCliConfig(existingConfig);
            console.log(`✅ Configuration saved to ${configPath}`);
            console.log(JSON.stringify(existingConfig, null, 2));
        });

    // ── hub ───────────────────────────────────────────────────────────────────

    const hubOutputOption = new Option(FORMAT_OPTION, 'Output format').choices(['json', 'pretty']).default('json');

    const hubVersionBumpOption = new Option('-t, --change-type <type>', 'Type of change for version bump when pushing a new version of an existing resource. Defaults to \'patch\'')
        .choices(['patch', 'minor', 'major'])
        .default('patch');

    const hubFailIfModifiedOption = new Option('--fail-if-modified', 'Strict mode: do not auto-bump. Skip if the document is unchanged from the latest published version; fail if it has changed. A brand-new mapping is still created at 1.0.0.')
        .default(false);

    const hubCmd = new Command('hub').description('Interact with CALM Hub');

    // hub push
    const hubPushCmd = hubCmd.command('push').description('Push a CALM document to CALM Hub');

    hubPushCmd
        .command('architecture <architecture-file>')
        .description('Push a CALM architecture file to CALM Hub. $id of document must contain a full document ID including namespace, type, mapping slug and version.')
        .option(NAME_OPTION, 'Name for the architecture in CALM Hub; overrides `title` field if set.')
        .option(DESCRIPTION_OPTION, 'Description for the architecture; overrides `description` field if set.')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .addOption(hubVersionBumpOption)
        .addOption(hubFailIfModifiedOption)
        .action(async (architectureFile, options) => {
            const pushOptions: PushOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                name: options.name,
                description: options.description,
                file: architectureFile,
                format: options.format,
                changeType: options.changeType.toUpperCase() as ResourceChangeType,
                failIfModified: options.failIfModified
            };
            await runPushArchitecture(pushOptions);
        });

    hubPushCmd
        .command('pattern <pattern-file>')
        .description('Push a CALM pattern file to CALM Hub. $id of document must contain a full document ID including namespace, type, mapping slug and version.')
        .option(NAME_OPTION, 'Name for the pattern in CALM Hub; overrides `title` field if set.')
        .option(DESCRIPTION_OPTION, 'Description for the pattern')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .addOption(hubVersionBumpOption)
        .addOption(hubFailIfModifiedOption)
        .action(async (patternFile, options) => {
            const pushPatternOptions: PushOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                name: options.name,
                description: options.description,
                file: patternFile,
                format: options.format,
                changeType: options.changeType.toUpperCase() as ResourceChangeType,
                failIfModified: options.failIfModified
            };
            await runPushPattern(pushPatternOptions);
        });

    hubPushCmd
        .command('standard <standard-file>')
        .description('Push a CALM standard file to CALM Hub. $id of document must contain a full document ID including namespace, type, mapping slug and version.')
        .option(NAME_OPTION, 'Name for the standard in CALM Hub')
        .option(DESCRIPTION_OPTION, 'Description for the standard')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .addOption(hubVersionBumpOption)
        .addOption(hubFailIfModifiedOption)
        .action(async (standardFile, options) => {
            const pushStandardOptions: PushOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                name: options.name,
                description: options.description,
                file: standardFile,
                format: options.format,
                changeType: options.changeType.toUpperCase() as ResourceChangeType,
                failIfModified: options.failIfModified
            };
            await runPushStandard(pushStandardOptions);
        });

    hubPushCmd
        .command('control-requirement <requirement-file>')
        .description('Push a control requirement version to CALM Hub. $id of document must contain a full control requirement document ID including domain, control name and version.')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .addOption(hubVersionBumpOption)
        .addOption(hubFailIfModifiedOption)
        .action(async (requirementFile, options) => {
            const pushOptions: PushControlOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                file: requirementFile,
                format: options.format,
                changeType: options.changeType.toUpperCase() as ResourceChangeType,
                failIfModified: options.failIfModified
            };
            await runPushControlRequirement(pushOptions);
        });

    hubPushCmd
        .command('control-configuration <config-file>')
        .description('Push a control configuration version to CALM Hub. $id of document must contain a full control configuration document ID including domain, control name, configuration name and version.')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .addOption(hubVersionBumpOption)
        .addOption(hubFailIfModifiedOption)
        .action(async (configFile, options) => {
            const pushOptions: PushControlOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                file: configFile,
                format: options.format,
                changeType: options.changeType.toUpperCase() as ResourceChangeType,
                failIfModified: options.failIfModified
            };
            await runPushControlConfiguration(pushOptions);
        });

    // hub pull
    const hubPullCmd = hubCmd.command('pull').description('Pull a CALM document from CALM Hub');

    hubPullCmd
        .command('architecture')
        .description('Pull a specific version of a CALM architecture from CALM Hub')
        .requiredOption(NAMESPACE_OPTION, 'Source namespace')
        .requiredOption(MAPPING_OPTION, 'Mapping slug of the architecture to pull')
        .option(HUB_VERSION_OPTION, 'Version to retrieve')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .option(OUTPUT_OPTION, 'Write output to this file instead of stdout')
        .action(async (options) => {
            const pullOptions: PullOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                namespace: options.namespace,
                mapping: options.mapping,
                version: options.ver,
                output: options.output
            };
            await runPullArchitecture(pullOptions);
        });

    hubPullCmd
        .command('pattern')
        .description('Pull a specific version of a CALM pattern from CALM Hub')
        .requiredOption(NAMESPACE_OPTION, 'Source namespace')
        .requiredOption(MAPPING_OPTION, 'Mapping slug of the pattern to pull')
        .option(HUB_VERSION_OPTION, 'Version to retrieve')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .option(OUTPUT_OPTION, 'Write output to this file instead of stdout')
        .action(async (options) => {
            const pullPatternOptions: PullOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                namespace: options.namespace,
                mapping: options.mapping,
                version: options.ver,
                output: options.output
            };
            await runPullPattern(pullPatternOptions);
        });

    hubPullCmd
        .command('standard')
        .description('Pull a specific version of a CALM standard from CALM Hub')
        .requiredOption(NAMESPACE_OPTION, 'Source namespace')
        .requiredOption(MAPPING_OPTION, 'Mapping slug of the standard to pull')
        .option(HUB_VERSION_OPTION, 'Version to retrieve')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .option(OUTPUT_OPTION, 'Write output to this file instead of stdout')
        .action(async (options) => {
            const pullStandardOptions: PullOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                namespace: options.namespace,
                mapping: options.mapping,
                version: options.ver,
                output: options.output
            };
            await runPullStandard(pullStandardOptions);
        });

    hubPullCmd
        .command('control-requirement')
        .description('Pull a control requirement version from CALM Hub')
        .requiredOption(DOMAIN_OPTION, 'Source domain')
        .requiredOption(CONTROL_NAME_OPTION, 'Control name')
        .option(HUB_VERSION_OPTION, 'Version to retrieve (defaults to the latest)')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .option(OUTPUT_OPTION, 'Write output to this file instead of stdout')
        .action(async (options) => {
            const pullOptions: PullControlOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                domain: options.domain,
                controlName: options.controlName,
                version: options.ver,
                output: options.output
            };
            await runPullControlRequirement(pullOptions);
        });

    hubPullCmd
        .command('control-configuration')
        .description('Pull a control configuration version from CALM Hub')
        .requiredOption(DOMAIN_OPTION, 'Source domain')
        .requiredOption(CONTROL_NAME_OPTION, 'Control name')
        .requiredOption(CONFIG_NAME_OPTION, 'Configuration name')
        .option(HUB_VERSION_OPTION, 'Version to retrieve (defaults to the latest)')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .option(OUTPUT_OPTION, 'Write output to this file instead of stdout')
        .action(async (options) => {
            const pullOptions: PullControlOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                domain: options.domain,
                controlName: options.controlName,
                configName: options.configName,
                version: options.ver,
                output: options.output
            };
            await runPullControlConfiguration(pullOptions);
        });

    // hub list
    const hubListCmd = hubCmd.command('list').description('List CALM Hub resources');

    hubListCmd
        .command('architectures')
        .description('List architectures in a namespace')
        .option(NAMESPACE_OPTION, 'Target namespace', 'default')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .action(async (options) => {
            const listOptions: ListOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                namespace: options.namespace,
                format: options.format
            };
            await runListArchitectures(listOptions);
        });

    hubListCmd
        .command('namespaces')
        .description('List all namespaces')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .action(async (options) => {
            const listOptions: ListNamespacesOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                format: options.format
            };
            await runListNamespaces(listOptions);
        });

    hubListCmd
        .command('patterns')
        .description('List patterns in a namespace')
        .option(NAMESPACE_OPTION, 'Target namespace', 'default')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .action(async (options) => {
            const listPatternsOptions: ListOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                namespace: options.namespace,
                format: options.format
            };
            await runListPatterns(listPatternsOptions);
        });

    hubListCmd
        .command('standards')
        .description('List standards in a namespace')
        .option(NAMESPACE_OPTION, 'Target namespace', 'default')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .action(async (options) => {
            const listStandardsOptions: ListOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                namespace: options.namespace,
                format: options.format
            };
            await runListStandards(listStandardsOptions);
        });

    hubListCmd
        .command('domains')
        .description('List all domains')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .action(async (options) => {
            const listOptions: ListDomainsOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                format: options.format
            };
            await runListDomains(listOptions);
        });

    hubListCmd
        .command('controls')
        .description('List control names in a domain')
        .requiredOption(DOMAIN_OPTION, 'Target domain')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .action(async (options) => {
            const listOptions: ListControlsOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                domain: options.domain,
                format: options.format
            };
            await runListControls(listOptions);
        });

    hubListCmd
        .command('control-configurations')
        .description('List configuration names for a control')
        .requiredOption(DOMAIN_OPTION, 'Target domain')
        .requiredOption(CONTROL_NAME_OPTION, 'Control name')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .action(async (options) => {
            const listOptions: ListControlConfigurationsOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                domain: options.domain,
                controlName: options.controlName,
                format: options.format
            };
            await runListControlConfigurations(listOptions);
        });

    // hub create
    const hubCreateCmd = hubCmd.command('create').description('Create CALM Hub resources');

    hubCreateCmd
        .command('namespace')
        .description('Create a new namespace in CALM Hub')
        .requiredOption(NAME_OPTION, 'Namespace name')
        .requiredOption(DESCRIPTION_OPTION, 'Namespace description')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .action(async (options) => {
            const createOptions: CreateNamespaceOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                name: options.name,
                description: options.description,
                format: options.format
            };
            await runCreateNamespace(createOptions);
        });

    hubCreateCmd
        .command('domain')
        .description('Create a new domain in CALM Hub')
        .requiredOption(NAME_OPTION, 'Domain name')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .addOption(hubOutputOption)
        .action(async (options) => {
            const createOptions: CreateDomainOptions = {
                calmHubOptions: { calmHubUrl: options.calmHubUrl },
                name: options.name,
                format: options.format
            };
            await runCreateDomain(createOptions);
        });

    program.addCommand(hubCmd);

}

interface ParseDocumentLoaderOptions {
    verbose?: boolean;
    calmHubUrl?: string;
    schemaDirectory?: string;
    allowedRemoteHosts?: string[];
}

export async function parseDocumentLoaderConfig(
    options: ParseDocumentLoaderOptions,
    urlToLocalMap?: Map<string, string>,
    basePath?: string
): Promise<DocumentLoaderOptions> {
    const logger = initLogger(options.verbose ?? false, 'calm-cli');
    const docLoaderOpts: DocumentLoaderOptions = {
        calmHubUrl: options.calmHubUrl,
        schemaDirectoryPath: options.schemaDirectory,
        urlToLocalMap: urlToLocalMap,
        basePath: basePath,
        allowedRemoteHosts: options.allowedRemoteHosts,
        debug: !!options.verbose
    };

    const userConfig = await cliConfig.loadCliConfig();
    if (userConfig && userConfig.calmHubUrl && !options.calmHubUrl) {
        logger.info('Using CALMHub URL from config file: ' + userConfig.calmHubUrl);
        docLoaderOpts.calmHubUrl = userConfig.calmHubUrl;
    }
    
    // if we have an auth plugin and we have calmHub configured
    if (userConfig && userConfig.authPluginPath) {
        logger.info('Loading auth plugin from config file: ' + userConfig.authPluginPath);
        try {
            const authPlugin = await cliConfig.loadAuthPlugin(userConfig.authPluginPath, !!options.verbose);
            docLoaderOpts.authPlugin = authPlugin;
            logger.debug('Auth plugin loaded successfully');
        } catch (err) {
            logger.error('Failed to load auth plugin: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    if (userConfig && userConfig.allowedRemoteHosts && !options.allowedRemoteHosts) {
        logger.info('Using allowed remote hosts from config file');
        docLoaderOpts.allowedRemoteHosts = userConfig.allowedRemoteHosts;
    }
    return docLoaderOpts;
}

export async function buildSchemaDirectory(docLoader: DocumentLoader, debug: boolean): Promise<SchemaDirectory> {
    return new SchemaDirectory(docLoader, debug);
}
