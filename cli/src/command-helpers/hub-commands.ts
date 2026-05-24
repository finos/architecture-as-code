import { readFile, writeFile } from 'fs/promises';
import { CalmHubClient, CalmHubOptions, HubArchitectureSummary, HubClientError, HubPatternSummary, HubStandardSummary, HubDomainSummary, HubControlSummary, HubDomainCreateResult } from '@finos/calm-shared';
import { OutputFormat, parseOutputFormat, printError, printJsonSuccess, printTableSuccess } from './hub-output';
import * as cliConfig from '../cli-config';

// ── Hub URL resolution ────────────────────────────────────────────────────────

class HubCommandError extends Error {
    /**
     * Creates a typed command error for user-facing Hub command failures.
     * @param status HTTP-like status code.
     * @param error Error message.
     * @param request Request label.
     */
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

/**
 * Prints a push operation result in either pretty table or JSON format.
 * @param result Push result payload.
 * @param format Output format selector.
 */
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

/**
 * Resolves missing architecture name/description from an existing architecture id.
 * @param client CALM Hub API client.
 * @param namespace Target namespace.
 * @param parsedId Architecture id.
 * @param name Optional name supplied by the user.
 * @param description Optional description supplied by the user.
 * @param format Output format used for error handling.
 * @returns Resolved name and description.
 */
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

/**
 * Pushes a new architecture version for an existing architecture id.
 * @param client CALM Hub API client.
 * @param options Command options.
 * @param fileContent Architecture JSON payload.
 * @param format Output format used for error handling.
 * @returns Push result with id, version, and location.
 */
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

/**
 * Resolves CALM Hub options and exits with formatted error output on failure.
 * @param opts Raw hub options.
 * @param format Output format used for errors.
 * @returns Fully-resolved hub options.
 */
async function handleOptionsLoadError(opts: CalmHubOptions, format: OutputFormat = 'json'): Promise<CalmHubOptions> {
    try {
        return await resolveCalmHubOptions(opts);
    } catch (err) {
        handleHubError(err, format);
    }
}

/**
 * Pushes a new architecture or a versioned update to CALM Hub.
 * @param options Command options.
 */
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

/**
 * Pulls an architecture version from CALM Hub and writes it to stdout or a file.
 * @param options Command options.
 */
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

/**
 * Lists architectures in a namespace.
 * @param options Command options.
 */
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

/**
 * Creates a new namespace in CALM Hub.
 * @param options Command options.
 */
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

/**
 * Lists all namespaces in CALM Hub.
 * @param options Command options.
 */
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

/**
 * Resolves missing pattern name/description from an existing pattern id.
 * @param client CALM Hub API client.
 * @param namespace Target namespace.
 * @param parsedId Pattern id.
 * @param name Optional name supplied by the user.
 * @param description Optional description supplied by the user.
 * @param format Output format used for error handling.
 * @returns Resolved name and description.
 */
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

/**
 * Pushes a new pattern version for an existing pattern id.
 * @param client CALM Hub API client.
 * @param options Command options.
 * @param fileContent Pattern JSON payload.
 * @param format Output format used for error handling.
 * @returns Push result with id, version, and location.
 */
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

/**
 * Pushes a new pattern or a versioned update to CALM Hub.
 * @param options Command options.
 */
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

/**
 * Pulls a pattern version from CALM Hub and writes it to stdout or a file.
 * @param options Command options.
 */
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

/**
 * Lists patterns in a namespace.
 * @param options Command options.
 */
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

/**
 * Resolves missing standard name/description from an existing standard id.
 * @param client CALM Hub API client.
 * @param namespace Target namespace.
 * @param parsedId Standard id.
 * @param name Optional name supplied by the user.
 * @param description Optional description supplied by the user.
 * @param format Output format used for error handling.
 * @returns Resolved name and description.
 */
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

/**
 * Pushes a new standard version for an existing standard id.
 * @param client CALM Hub API client.
 * @param options Command options.
 * @param fileContent Standard JSON payload.
 * @param format Output format used for error handling.
 * @returns Push result with id, version, and location.
 */
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

/**
 * Pushes a new standard or a versioned update to CALM Hub.
 * @param options Command options.
 */
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

/**
 * Pulls a standard version from CALM Hub and writes it to stdout or a file.
 * @param options Command options.
 */
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

/**
 * Lists standards in a namespace.
 * @param options Command options.
 */
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

/**
 * Prints an id-based creation result in either pretty table or JSON format.
 * @param result Creation result payload.
 * @param format Output format selector.
 */
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

/**
 * Creates a domain in CALM Hub.
 * @param options Command options.
 */
export async function runCreateDomain(options: CreateDomainOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const result: HubDomainCreateResult = await client.createDomain(options.name);
        if (format === 'pretty') {
            printTableSuccess(
                [{ STATUS: 'Created', NAME: result.name, LOCATION: result.location }],
                [
                    { key: 'STATUS', header: 'STATUS' },
                    { key: 'NAME', header: 'NAME' },
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

// ── list domains ─────────────────────────────────────────────────────────────

export interface ListDomainsOptions {
    calmHubOptions: CalmHubOptions;
    format?: string;
}

/**
 * Lists domains in CALM Hub.
 * @param options Command options.
 */
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

export interface CreateControlRequirementOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    name: string;
    description: string;
    file: string;
    format?: string;
}

/**
 * Creates a control requirement from a local JSON file.
 * @param options Command options.
 */
export async function runCreateControlRequirement(options: CreateControlRequirementOptions): Promise<void> {
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
        printError(0, `Could not read file: ${options.file}`, `create control-requirement ${options.file}`, format);
        process.exit(1);
    }

    try {
        JSON.parse(fileContent);
    } catch {
        printError(0, `File is not valid JSON: ${options.file}`, `create control-requirement ${options.file}`, format);
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

export interface ListControlRequirementsOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    format?: string;
}

/**
 * Lists controls for a domain.
 * @param options Command options.
 */
export async function runListControlRequirements(options: ListControlRequirementsOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const controls: HubControlSummary[] = await client.listControls(options.domain);

        if (format === 'pretty') {
            printTableSuccess(
                controls.map(c => ({ ID: c.id, NAME: c.name, DESCRIPTION: c.description ?? '' })),
                [
                    { key: 'ID', header: 'ID' },
                    { key: 'NAME', header: 'NAME' },
                    { key: 'DESCRIPTION', header: 'DESCRIPTION' }
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
    name?: string;
    description?: string;
    file: string;
    format?: string;
}

/**
 * Pushes a versioned control requirement from a local JSON file.
 * @param options Command options.
 */
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
        const trimmedName = options.name?.trim();
        const trimmedDescription = options.description?.trim();

        let resolvedName = trimmedName;
        let resolvedDescription = trimmedDescription;

        if (!resolvedName || !resolvedDescription) {
            const controls = await client.listControls(options.domain);
            const matchingControl = controls.find(control => control.id === parsedControlId);

            if (!matchingControl) {
                printError(
                    0,
                    `Control with id ${parsedControlId} not found in domain ${options.domain}`,
                    'push control-requirement',
                    format
                );
                process.exit(1);
            }

            if (!resolvedName) {
                resolvedName = matchingControl.name?.trim();
            }

            if (!resolvedDescription) {
                resolvedDescription = matchingControl.description?.trim();
            }

            if (!resolvedName || !resolvedDescription) {
                printError(
                    0,
                    `Control with id ${parsedControlId} in domain ${options.domain} is missing name or description`,
                    'push control-requirement',
                    format
                );
                process.exit(1);
            }
        }

        const result = await client.pushControlRequirement(
            options.domain,
            parsedControlId,
            options.version,
            resolvedName,
            resolvedDescription,
            fileContent
        );
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

/**
 * Pulls a versioned control requirement and writes it to stdout or a file.
 * @param options Command options.
 */
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

// ── push control-configuration ───────────────────────────────────────────────

export interface PushControlConfigurationOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    controlId: string;
    configId: string;
    version: string;
    file: string;
    format?: string;
}

/**
 * Pushes a versioned control configuration from a local JSON file.
 * @param options Command options.
 */
export async function runPushControlConfiguration(options: PushControlConfigurationOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);

    const parsedControlId = parseInt(options.controlId, 10);
    if (!Number.isFinite(parsedControlId)) {
        printError(0, '--control-id must be a valid integer', 'push control-configuration', format);
        process.exit(1);
    }

    const parsedConfigId = parseInt(options.configId, 10);
    if (!Number.isFinite(parsedConfigId)) {
        printError(0, '--config-id must be a valid integer', 'push control-configuration', format);
        process.exit(1);
    }

    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    let fileContent: string;
    try {
        fileContent = await readFile(options.file, 'utf-8');
    } catch {
        printError(0, `Could not read file: ${options.file}`, `push control-configuration ${options.file}`, format);
        process.exit(1);
    }

    try {
        JSON.parse(fileContent);
    } catch {
        printError(0, `File is not valid JSON: ${options.file}`, `push control-configuration ${options.file}`, format);
        process.exit(1);
    }

    try {
        const result = await client.pushControlConfiguration(options.domain, parsedControlId, parsedConfigId, options.version, fileContent);
        printPushResult(result, format);
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── pull control-configuration ───────────────────────────────────────────────

export interface PullControlConfigurationOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    controlId: string;
    configId: string;
    version: string;
    output?: string;
}

/**
 * Pulls a versioned control configuration and writes it to stdout or a file.
 * @param options Command options.
 */
export async function runPullControlConfiguration(options: PullControlConfigurationOptions): Promise<void> {
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, 'json');
    const client = new CalmHubClient(calmHubOptions);

    const parsedControlId = parseInt(options.controlId, 10);
    if (!Number.isFinite(parsedControlId)) {
        printError(0, '--control-id must be a valid integer', 'pull control-configuration', 'json');
        process.exit(1);
    }

    const parsedConfigId = parseInt(options.configId, 10);
    if (!Number.isFinite(parsedConfigId)) {
        printError(0, '--config-id must be a valid integer', 'pull control-configuration', 'json');
        process.exit(1);
    }

    try {
        const result = await client.pullControlConfiguration(options.domain, parsedControlId, parsedConfigId, options.version);
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

// ── create control-configuration ──────────────────────────────────────────────

export interface CreateControlConfigurationOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    controlId: string;
    file: string;
    format?: string;
}

/**
 * Creates a control configuration from a local JSON file.
 * @param options Command options.
 */
export async function runCreateControlConfiguration(options: CreateControlConfigurationOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);

    const parsedControlId = parseInt(options.controlId, 10);
    if (!Number.isFinite(parsedControlId)) {
        printError(0, '--control-id must be a valid integer', 'create control-configuration', format);
        process.exit(1);
    }

    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    let fileContent: string;
    try {
        fileContent = await readFile(options.file, 'utf-8');
    } catch {
        printError(0, `Could not read file: ${options.file}`, `create control-configuration ${options.file}`, format);
        process.exit(1);
    }

    try {
        JSON.parse(fileContent);
    } catch {
        printError(0, `File is not valid JSON: ${options.file}`, `create control-configuration ${options.file}`, format);
        process.exit(1);
    }

    try {
        const result = await client.createControlConfiguration(options.domain, parsedControlId, fileContent);
        printIdCreateResult(result as { id: number; location: string }, format);
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── list control-configurations ───────────────────────────────────────────────

export interface ListControlConfigurationsOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    controlId: string;
    format?: string;
}

/**
 * Summarizes a control configuration with the versions available for it.
 */
interface ControlConfigurationSummary {
    id: number;
    versions: string[];
}

/**
 * Lists control configurations for a control requirement, including the versions available for each configuration.
 * @param options Command options.
 */
export async function runListControlConfigurations(options: ListControlConfigurationsOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);

    const parsedControlId = parseInt(options.controlId, 10);
    if (!Number.isFinite(parsedControlId)) {
        printError(0, '--control-id must be a valid integer', 'list control-configurations', format);
        process.exit(1);
    }

    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const ids: number[] = await client.listControlConfigurations(options.domain, parsedControlId);
        const sortedIds = [...ids].sort((a, b) => a - b);
        const configurations: ControlConfigurationSummary[] = [];

        for (const id of sortedIds) {
            const versions = await client.listControlConfigurationVersions(options.domain, parsedControlId, id);
            configurations.push({ id, versions });
        }

        if (format === 'pretty') {
            printTableSuccess(
                configurations.map(configuration => ({
                    ID: configuration.id,
                    VERSIONS: configuration.versions.join(', ')
                })),
                [
                    { key: 'ID', header: 'ID' },
                    { key: 'VERSIONS', header: 'VERSIONS' }
                ]
            );
        } else {
            printJsonSuccess(configurations);
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── list control-requirement-versions ────────────────────────────────────────

export interface ListControlRequirementVersionsOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    controlId: string;
    format?: string;
}

/**
 * Lists available requirement versions for a control.
 * @param options Command options.
 */
export async function runListControlRequirementVersions(options: ListControlRequirementVersionsOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);

    const parsedControlId = parseInt(options.controlId, 10);
    if (!Number.isFinite(parsedControlId)) {
        printError(0, '--control-id must be a valid integer', 'list control-requirement-versions', format);
        process.exit(1);
    }

    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const versions: string[] = await client.listControlRequirementVersions(options.domain, parsedControlId);

        if (format === 'pretty') {
            printTableSuccess(
                versions.map(v => ({ VERSION: v })),
                [{ key: 'VERSION', header: 'VERSION' }]
            );
        } else {
            printJsonSuccess(versions);
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── shared error handler ──────────────────────────────────────────────────────

/**
 * Normalizes and prints Hub errors, then exits the process.
 * @param err Thrown error.
 * @param format Output format selector.
 */
function handleHubError(err: unknown, format: OutputFormat): never {
    if (err instanceof HubClientError || err instanceof HubCommandError) {
        printError(err.status, err.error, err.request, format);
    } else {
        printError(0, err instanceof Error ? err.message : String(err), 'unknown', format);
    }
    process.exit(1);
}
