import { readFile, writeFile } from 'fs/promises';
import { CalmHubClient, CalmHubOptions, HubArchitectureSummary, HubClientError } from '@finos/calm-shared';
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

// ── shared error handler ──────────────────────────────────────────────────────

function handleHubError(err: unknown, format: OutputFormat): never {
    if (err instanceof HubClientError || err instanceof HubCommandError) {
        printError(err.status, err.error, err.request, format);
    } else {
        printError(0, err instanceof Error ? err.message : String(err), 'unknown', format);
    }
    process.exit(1);
}
