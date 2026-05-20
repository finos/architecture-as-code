import { readFile, writeFile } from 'fs/promises';
import { CalmHubClient, CalmHubOptions, HubArchitectureSummary, HubClientError, HubPatternSummary, HubStandardSummary, HubDomainSummary, HubControlSummary } from '@finos/calm-shared';
import { OutputFormat, parseOutputFormat, printError, printJsonSuccess, printTableSuccess } from './hub-output';
import * as cliConfig from '../cli-config';

// ── Hub URL resolution ────────────────────────────────────────────────────────

class HubCommandError extends Error {
    constructor(
        public status: number,
        public error: string,
        public request: string
    ) {
        super(error);
        this.name = 'HubCommandError';
    }
}

/**
 * Fully resolve the calmhub options. If we have CLI params, prefer those, and fill in any missing values from the config file if present.
 * @param options The options to populate
 * @returns Fully-resolved options with config file options set.
 */
export async function resolveCalmHubOptions(inputOptions: CalmHubOptions): Promise<CalmHubOptions> {
    const options = { ...inputOptions };
    const config = await cliConfig.loadCliConfig();
    // set the options from config if they are not already set from command line
    if (config && config.calmHubUrl && !options.calmHubUrl) {
        options.calmHubUrl = config.calmHubUrl;
    }
    if (config && config.authPluginPath && !options.authPlugin) {
        options.authPlugin = await cliConfig.loadAuthPlugin(config.authPluginPath, false); // TODO logging
    }

    if (!options.calmHubUrl) {
        throw new HubCommandError(
            0,
            'No CALM Hub URL provided. Use --calm-hub-url or set calmHubUrl in ~/.calm.json',
            'resolve hub URL'
        );
    }
    return options;
}

// ── push architecture ─────────────────────────────────────────────────────────

export interface PushArchitectureOptions {
    calmHubOptions: CalmHubOptions;
    namespace: string;
    name?: string;
    description?: string;
    file: string;
    id?: string;
    version?: string;
    format?: string;
}

export interface PushArchitectureResult {
    id: number;
    version?: string;
    location: string;
}

export function printPushResult(result: PushArchitectureResult, format: OutputFormat): void {
    if (format === 'pretty') {
        printTableSuccess(
            [{ STATUS: 'Created', ID: result.id, VERSION: result.version ?? '', LOCATION: result.location }],
            [
                { key: 'STATUS', header: 'STATUS' },
                { key: 'ID', header: 'ID' },
                { key: 'VERSION', header: 'VERSION' },
                { key: 'LOCATION', header: 'LOCATION' }
            ]
        );
    } else {
        printJsonSuccess(result);
    }
}

export async function resolveVersionedMetadata(
    client: CalmHubClient,
    namespace: string,
    parsedId: number,
    name: string | undefined,
    description: string | undefined,
    format: OutputFormat
): Promise<{ name: string; description: string }> {
    if (name && description !== undefined) {
        return { name, description };
    }

    let architectures: HubArchitectureSummary[] = [];
    try {
        architectures = await client.listArchitectures(namespace);
    } catch (err) {
        handleHubError(err, format);
    }
    const existing = architectures.find(a => a.id === parsedId);
    if (!existing) {
        printError(0, `Architecture with id ${parsedId} not found in namespace ${namespace}`, 'push architecture', format);
        process.exit(1);
    }
    return {
        name: name ?? existing.name,
        description: description ?? existing.description ?? ''
    };
}

export async function pushVersioned(
    client: CalmHubClient,
    options: PushArchitectureOptions,
    fileContent: string,
    format: OutputFormat
): Promise<PushArchitectureResult> {
    if (!options.version) {
        printError(0, '--version is required when --id is provided', 'push architecture', format);
        process.exit(1);
    }

    const parsedId = parseInt(options.id!, 10);
    if (!Number.isFinite(parsedId)) {
        printError(0, '--id must be a valid integer', 'push architecture', format);
        process.exit(1);
    }

    const { name, description } = await resolveVersionedMetadata(
        client,
        options.namespace,
        parsedId,
        options.name,
        options.description,
        format
    );

    return client.pushArchitectureVersion(
        options.namespace,
        parsedId,
        options.version,
        name,
        description,
        fileContent
    );
}

async function handleOptionsLoadError(opts: CalmHubOptions, format: OutputFormat = 'json'): Promise<CalmHubOptions> {
    try {
        return await resolveCalmHubOptions(opts);
    } catch (err) {
        handleHubError(err, format);
    }
}

export async function runPushArchitecture(options: PushArchitectureOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);

    if (!options.id && !options.name) {
        printError(0, '--name is required when creating a new architecture', 'push architecture', format);
        process.exit(1);
    }

    if (!options.id && !options.description) {
        printError(0, '--description is required when creating a new architecture', 'push architecture', format);
        process.exit(1);
    }

    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    let fileContent: string;
    try {
        fileContent = await readFile(options.file, 'utf-8');
    } catch {
        printError(0, `Could not read file: ${options.file}`, `push architecture ${options.file}`, format);
        process.exit(1);
    }

    // Validate the file is parseable JSON before sending
    try {
        JSON.parse(fileContent);
    } catch {
        printError(0, `File is not valid JSON: ${options.file}`, `push architecture ${options.file}`, format);
        process.exit(1);
    }

    try {
        const result = options.id
            ? await pushVersioned(client, options, fileContent, format)
            : await client.pushArchitecture(options.namespace, options.name!, options.description!, fileContent);
        printPushResult(result, format);
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── pull architecture ─────────────────────────────────────────────────────────

export interface PullArchitectureOptions {
    calmHubOptions: CalmHubOptions;
    namespace: string;
    id: string;
    version: string;
    output?: string;
}

export async function runPullArchitecture(options: PullArchitectureOptions): Promise<void> {
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions);
    const client = new CalmHubClient(calmHubOptions);

    const parsedId = parseInt(options.id, 10);
    if (!Number.isFinite(parsedId)) {
        printError(0, '--id must be a valid integer', 'pull architecture', 'json');
        process.exit(1);
    }

    try {
        const result = await client.pullArchitecture(options.namespace, parsedId, options.version);
        const pretty = JSON.stringify(result, null, 2);

        if (options.output) {
            await writeFile(options.output, pretty, 'utf-8');
        } else {
            console.log(pretty);
        }
    } catch (err) {
        handleHubError(err, 'json');
    }
}

// ── list architectures ────────────────────────────────────────────────────────

export interface ListArchitecturesOptions {
    calmHubOptions: CalmHubOptions;
    namespace: string;
    format?: string;
}

export async function runListArchitectures(options: ListArchitecturesOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const architectures = await client.listArchitectures(options.namespace);

        if (format === 'pretty') {
            printTableSuccess(
                architectures.map(a => ({ ID: a.id, NAME: a.name, VERSIONS: a.versions.join(', ') })),
                [
                    { key: 'ID', header: 'ID' },
                    { key: 'NAME', header: 'NAME' },
                    { key: 'VERSIONS', header: 'VERSIONS' }
                ]
            );
        } else {
            printJsonSuccess(architectures);
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── create namespace ──────────────────────────────────────────────────────────

export interface CreateNamespaceOptions {
    calmHubOptions: CalmHubOptions;
    name: string;
    description?: string;
    format?: string;
}

export async function runCreateNamespace(options: CreateNamespaceOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    if (!options.description?.trim()) {
        handleHubError(new Error('--description is required and must not be blank'), format);
    }
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const result = await client.createNamespace(options.name, options.description);

        if (format === 'pretty') {
            printTableSuccess(
                [{ STATUS: 'Created', ID: result.name, LOCATION: result.location }],
                [
                    { key: 'STATUS', header: 'STATUS' },
                    { key: 'ID', header: 'NAME' },
                    { key: 'LOCATION', header: 'LOCATION' }
                ]
            );
        } else {
            printJsonSuccess({ name: result.name, location: result.location });
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── list namespaces ───────────────────────────────────────────────────────────

export interface ListNamespacesOptions {
    calmHubOptions: CalmHubOptions;
    format?: string;
}

export async function runListNamespaces(options: ListNamespacesOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const namespaces = await client.listNamespaces();

        if (format === 'pretty') {
            printTableSuccess(
                namespaces.map(n => ({ NAME: n.name, DESCRIPTION: n.description ?? '' })),
                [
                    { key: 'NAME', header: 'NAME' },
                    { key: 'DESCRIPTION', header: 'DESCRIPTION' }
                ]
            );
        } else {
            printJsonSuccess(namespaces);
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── push pattern ──────────────────────────────────────────────────────────────

export interface PushPatternOptions {
    calmHubOptions: CalmHubOptions;
    namespace: string;
    name?: string;
    description?: string;
    file: string;
    id?: string;
    version?: string;
    format?: string;
}

export async function resolvePatternMetadata(
    client: CalmHubClient,
    namespace: string,
    parsedId: number,
    name: string | undefined,
    description: string | undefined,
    format: OutputFormat
): Promise<{ name: string; description: string }> {
    if (name && description !== undefined) {
        return { name, description };
    }

    let patterns: HubPatternSummary[] = [];
    try {
        patterns = await client.listPatterns(namespace);
    } catch (err) {
        handleHubError(err, format);
    }
    const existing = patterns.find(p => p.id === parsedId);
    if (!existing) {
        printError(0, `Pattern with id ${parsedId} not found in namespace ${namespace}`, 'push pattern', format);
        process.exit(1);
    }
    return {
        name: name ?? existing.name,
        description: description ?? existing.description ?? ''
    };
}

export async function pushPatternVersioned(
    client: CalmHubClient,
    options: PushPatternOptions,
    fileContent: string,
    format: OutputFormat
): Promise<PushArchitectureResult> {
    if (!options.version) {
        printError(0, '--ver is required when --id is provided', 'push pattern', format);
        process.exit(1);
    }

    const parsedId = parseInt(options.id!, 10);
    if (!Number.isFinite(parsedId)) {
        printError(0, '--id must be a valid integer', 'push pattern', format);
        process.exit(1);
    }

    const { name, description } = await resolvePatternMetadata(
        client,
        options.namespace,
        parsedId,
        options.name,
        options.description,
        format
    );

    return client.pushPatternVersion(
        options.namespace,
        parsedId,
        options.version,
        name,
        description,
        fileContent
    );
}

export async function runPushPattern(options: PushPatternOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);

    if (!options.id && !options.name) {
        printError(0, '--name is required when creating a new pattern', 'push pattern', format);
        process.exit(1);
    }

    if (!options.id && !options.description) {
        printError(0, '--description is required when creating a new pattern', 'push pattern', format);
        process.exit(1);
    }

    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    let fileContent: string;
    try {
        fileContent = await readFile(options.file, 'utf-8');
    } catch {
        printError(0, `Could not read file: ${options.file}`, `push pattern ${options.file}`, format);
        process.exit(1);
    }

    try {
        JSON.parse(fileContent);
    } catch {
        printError(0, `File is not valid JSON: ${options.file}`, `push pattern ${options.file}`, format);
        process.exit(1);
    }

    try {
        const result = options.id
            ? await pushPatternVersioned(client, options, fileContent, format)
            : await client.pushPattern(options.namespace, options.name!, options.description!, fileContent);
        printPushResult(result, format);
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── pull pattern ──────────────────────────────────────────────────────────────

export interface PullPatternOptions {
    calmHubOptions: CalmHubOptions;
    namespace: string;
    id: string;
    version: string;
    output?: string;
}

export async function runPullPattern(options: PullPatternOptions): Promise<void> {
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, 'json');
    const client = new CalmHubClient(calmHubOptions);

    const parsedId = parseInt(options.id, 10);
    if (!Number.isFinite(parsedId)) {
        printError(0, '--id must be a valid integer', 'pull pattern', 'json');
        process.exit(1);
    }

    try {
        const result = await client.pullPattern(options.namespace, parsedId, options.version);
        const pretty = JSON.stringify(result, null, 2);

        if (options.output) {
            await writeFile(options.output, pretty, 'utf-8');
        } else {
            console.log(pretty);
        }
    } catch (err) {
        handleHubError(err, 'json');
    }
}

// ── list patterns ─────────────────────────────────────────────────────────────

export interface ListPatternsOptions {
    calmHubOptions: CalmHubOptions;
    namespace: string;
    format?: string;
}

export async function runListPatterns(options: ListPatternsOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const patterns = await client.listPatterns(options.namespace);

        if (format === 'pretty') {
            printTableSuccess(
                patterns.map(p => ({ ID: p.id, NAME: p.name, VERSIONS: p.versions.join(', ') })),
                [
                    { key: 'ID', header: 'ID' },
                    { key: 'NAME', header: 'NAME' },
                    { key: 'VERSIONS', header: 'VERSIONS' }
                ]
            );
        } else {
            printJsonSuccess(patterns);
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── push standard ─────────────────────────────────────────────────────────────

export interface PushStandardOptions {
    calmHubOptions: CalmHubOptions;
    namespace: string;
    name?: string;
    description?: string;
    file: string;
    id?: string;
    version?: string;
    format?: string;
}

export async function resolveStandardMetadata(
    client: CalmHubClient,
    namespace: string,
    parsedId: number,
    name: string | undefined,
    description: string | undefined,
    format: OutputFormat
): Promise<{ name: string; description: string }> {
    if (name && description !== undefined) {
        return { name, description };
    }

    let standards: HubStandardSummary[] = [];
    try {
        standards = await client.listStandards(namespace);
    } catch (err) {
        handleHubError(err, format);
    }
    const existing = standards.find(s => s.id === parsedId);
    if (!existing) {
        printError(0, `Standard with id ${parsedId} not found in namespace ${namespace}`, 'push standard', format);
        process.exit(1);
    }
    return {
        name: name ?? existing.name,
        description: description ?? existing.description ?? ''
    };
}

export async function pushStandardVersioned(
    client: CalmHubClient,
    options: PushStandardOptions,
    fileContent: string,
    format: OutputFormat
): Promise<PushArchitectureResult> {
    if (!options.version) {
        printError(0, '--ver is required when --id is provided', 'push standard', format);
        process.exit(1);
    }

    const parsedId = parseInt(options.id!, 10);
    if (!Number.isFinite(parsedId)) {
        printError(0, '--id must be a valid integer', 'push standard', format);
        process.exit(1);
    }

    const { name, description } = await resolveStandardMetadata(
        client,
        options.namespace,
        parsedId,
        options.name,
        options.description,
        format
    );

    return client.pushStandardVersion(
        options.namespace,
        parsedId,
        options.version,
        name,
        description,
        fileContent
    );
}

export async function runPushStandard(options: PushStandardOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);

    if (!options.id && !options.name) {
        printError(0, '--name is required when creating a new standard', 'push standard', format);
        process.exit(1);
    }

    if (!options.id && !options.description) {
        printError(0, '--description is required when creating a new standard', 'push standard', format);
        process.exit(1);
    }

    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    let fileContent: string;
    try {
        fileContent = await readFile(options.file, 'utf-8');
    } catch {
        printError(0, `Could not read file: ${options.file}`, `push standard ${options.file}`, format);
        process.exit(1);
    }

    try {
        JSON.parse(fileContent);
    } catch {
        printError(0, `File is not valid JSON: ${options.file}`, `push standard ${options.file}`, format);
        process.exit(1);
    }

    try {
        const result = options.id
            ? await pushStandardVersioned(client, options, fileContent, format)
            : await client.pushStandard(options.namespace, options.name!, options.description!, fileContent);
        printPushResult(result, format);
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── pull standard ─────────────────────────────────────────────────────────────

export interface PullStandardOptions {
    calmHubOptions: CalmHubOptions;
    namespace: string;
    id: string;
    version: string;
    output?: string;
}

export async function runPullStandard(options: PullStandardOptions): Promise<void> {
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, 'json');
    const client = new CalmHubClient(calmHubOptions);

    const parsedId = parseInt(options.id, 10);
    if (!Number.isFinite(parsedId)) {
        printError(0, '--id must be a valid integer', 'pull standard', 'json');
        process.exit(1);
    }

    try {
        const result = await client.pullStandard(options.namespace, parsedId, options.version);
        const pretty = JSON.stringify(result, null, 2);

        if (options.output) {
            await writeFile(options.output, pretty, 'utf-8');
        } else {
            console.log(pretty);
        }
    } catch (err) {
        handleHubError(err, 'json');
    }
}

// ── list standards ────────────────────────────────────────────────────────────

export interface ListStandardsOptions {
    calmHubOptions: CalmHubOptions;
    namespace: string;
    format?: string;
}

export async function runListStandards(options: ListStandardsOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const standards = await client.listStandards(options.namespace);

        if (format === 'pretty') {
            printTableSuccess(
                standards.map(s => ({ ID: s.id, NAME: s.name, DESCRIPTION: s.description ?? '', VERSIONS: s.versions.join(', ') })),
                [
                    { key: 'ID', header: 'ID' },
                    { key: 'NAME', header: 'NAME' },
                    { key: 'DESCRIPTION', header: 'DESCRIPTION' },
                    { key: 'VERSIONS', header: 'VERSIONS' }
                ]
            );
        } else {
            printJsonSuccess(standards);
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── create domain ───────────────────────────────────────────────────────────

export interface CreateDomainOptions {
    calmHubOptions: CalmHubOptions;
    name: string;
    format?: string;
}

export function printIdCreateResult(result: { id: number; location: string }, format: OutputFormat): void {
    if (format === 'pretty') {
        printTableSuccess(
            [{ STATUS: 'Created', ID: result.id, LOCATION: result.location }],
            [
                { key: 'STATUS', header: 'STATUS' },
                { key: 'ID', header: 'ID' },
                { key: 'LOCATION', header: 'LOCATION' }
            ]
        );
    } else {
        printJsonSuccess({ id: result.id, location: result.location });
    }
}

export async function runCreateDomain(options: CreateDomainOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const result = await client.createDomain(options.name);
        printIdCreateResult(result, format);
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── list domains ─────────────────────────────────────────────────────────────

export interface ListDomainsOptions {
    calmHubOptions: CalmHubOptions;
    format?: string;
}

export async function runListDomains(options: ListDomainsOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const domains: HubDomainSummary[] = await client.listDomains();

        if (format === 'pretty') {
            printTableSuccess(
                domains.map(d => ({ NAME: d.name })),
                [{ key: 'NAME', header: 'NAME' }]
            );
        } else {
            printJsonSuccess(domains);
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── create control ────────────────────────────────────────────────────────────

export interface CreateControlOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    name: string;
    description: string;
    file: string;
    format?: string;
}

export async function runCreateControl(options: CreateControlOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);

    if (!options.name?.trim()) {
        handleHubError(new Error('--name is required and must not be blank'), format);
    }
    if (!options.description?.trim()) {
        handleHubError(new Error('--description is required and must not be blank'), format);
    }

    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    let fileContent: string;
    try {
        fileContent = await readFile(options.file, 'utf-8');
    } catch {
        printError(0, `Could not read file: ${options.file}`, `create control ${options.file}`, format);
        process.exit(1);
    }

    try {
        JSON.parse(fileContent);
    } catch {
        printError(0, `File is not valid JSON: ${options.file}`, `create control ${options.file}`, format);
        process.exit(1);
    }

    try {
        const result = await client.createControl(options.domain, options.name, options.description, fileContent);
        printIdCreateResult(result, format);
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── list controls ─────────────────────────────────────────────────────────────

export interface ListControlsOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    format?: string;
}

export async function runListControls(options: ListControlsOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const controls: HubControlSummary[] = await client.listControls(options.domain);

        if (format === 'pretty') {
            printTableSuccess(
                controls.map(c => ({ ID: c.id, NAME: c.name })),
                [
                    { key: 'ID', header: 'ID' },
                    { key: 'NAME', header: 'NAME' }
                ]
            );
        } else {
            printJsonSuccess(controls);
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── push control-requirement ──────────────────────────────────────────────────

export interface PushControlRequirementOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    controlId: string;
    version: string;
    file: string;
    format?: string;
}

export async function runPushControlRequirement(options: PushControlRequirementOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);

    const parsedControlId = parseInt(options.controlId, 10);
    if (!Number.isFinite(parsedControlId)) {
        printError(0, '--control-id must be a valid integer', 'push control-requirement', format);
        process.exit(1);
    }

    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    let fileContent: string;
    try {
        fileContent = await readFile(options.file, 'utf-8');
    } catch {
        printError(0, `Could not read file: ${options.file}`, `push control-requirement ${options.file}`, format);
        process.exit(1);
    }

    try {
        JSON.parse(fileContent);
    } catch {
        printError(0, `File is not valid JSON: ${options.file}`, `push control-requirement ${options.file}`, format);
        process.exit(1);
    }

    try {
        const result = await client.pushControlRequirement(options.domain, parsedControlId, options.version, fileContent);
        printPushResult(result, format);
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── pull control-requirement ──────────────────────────────────────────────────

export interface PullControlRequirementOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    controlId: string;
    version: string;
    output?: string;
}

export async function runPullControlRequirement(options: PullControlRequirementOptions): Promise<void> {
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, 'json');
    const client = new CalmHubClient(calmHubOptions);

    const parsedControlId = parseInt(options.controlId, 10);
    if (!Number.isFinite(parsedControlId)) {
        printError(0, '--control-id must be a valid integer', 'pull control-requirement', 'json');
        process.exit(1);
    }

    try {
        const result = await client.pullControlRequirement(options.domain, parsedControlId, options.version);
        const pretty = JSON.stringify(result, null, 2);

        if (options.output) {
            await writeFile(options.output, pretty, 'utf-8');
        } else {
            console.log(pretty);
        }
    } catch (err) {
        handleHubError(err, 'json');
    }
}

// ── push control-config ───────────────────────────────────────────────────────

export interface PushControlConfigOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    controlId: string;
    configId: string;
    version: string;
    file: string;
    format?: string;
}

export async function runPushControlConfig(options: PushControlConfigOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);

    const parsedControlId = parseInt(options.controlId, 10);
    if (!Number.isFinite(parsedControlId)) {
        printError(0, '--control-id must be a valid integer', 'push control-config', format);
        process.exit(1);
    }

    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    let fileContent: string;
    try {
        fileContent = await readFile(options.file, 'utf-8');
    } catch {
        printError(0, `Could not read file: ${options.file}`, `push control-config ${options.file}`, format);
        process.exit(1);
    }

    try {
        JSON.parse(fileContent);
    } catch {
        printError(0, `File is not valid JSON: ${options.file}`, `push control-config ${options.file}`, format);
        process.exit(1);
    }

    try {
        const result = await client.pushControlConfig(options.domain, parsedControlId, options.configId, options.version, fileContent);
        printPushResult(result, format);
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── pull control-config ───────────────────────────────────────────────────────

export interface PullControlConfigOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    controlId: string;
    configId: string;
    version: string;
    output?: string;
}

export async function runPullControlConfig(options: PullControlConfigOptions): Promise<void> {
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, 'json');
    const client = new CalmHubClient(calmHubOptions);

    const parsedControlId = parseInt(options.controlId, 10);
    if (!Number.isFinite(parsedControlId)) {
        printError(0, '--control-id must be a valid integer', 'pull control-config', 'json');
        process.exit(1);
    }

    try {
        const result = await client.pullControlConfig(options.domain, parsedControlId, options.configId, options.version);
        const pretty = JSON.stringify(result, null, 2);

        if (options.output) {
            await writeFile(options.output, pretty, 'utf-8');
        } else {
            console.log(pretty);
        }
    } catch (err) {
        handleHubError(err, 'json');
    }
}

// ── shared error handler ──────────────────────────────────────────────────────

function handleHubError(err: unknown, format: OutputFormat): never {
    if (err instanceof HubClientError || err instanceof HubCommandError) {
        printError(err.status, err.error, err.request, format);
    } else {
        printError(0, err instanceof Error ? err.message : String(err), 'unknown', format);
    }
    process.exit(1);
}
