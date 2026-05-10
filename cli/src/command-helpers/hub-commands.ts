import { readFile, writeFile } from 'fs/promises';
import { CalmHubClient, HubClientError } from '@finos/calm-shared';
import { OutputFormat, parseOutputFormat, printError, printJsonSuccess, printTableSuccess } from './hub-output';
import * as cliConfig from '../cli-config';

// ── Hub URL resolution ────────────────────────────────────────────────────────

export async function resolveHubUrl(options: { calmHubUrl?: string }): Promise<string> {
    if (options.calmHubUrl) return options.calmHubUrl;

    const config = await cliConfig.loadCliConfig();
    if (config?.calmHubUrl) return config.calmHubUrl;

    printError(0, 'No CALM Hub URL provided. Use --calm-hub-url or set calmHubUrl in ~/.calm.json', 'resolve hub URL', 'json');
    process.exit(1);
}

// ── push architecture ─────────────────────────────────────────────────────────

export interface PushArchitectureOptions {
    calmHubUrl?: string;
    namespace: string;
    name?: string;
    description?: string;
    file: string;
    id?: string;
    version?: string;
    format?: string;
}

export async function runPushArchitecture(options: PushArchitectureOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);

    if (!options.id && !options.name) {
        printError(0, '--name is required when creating a new architecture', 'push architecture', format);
        process.exit(1);
    }

    const hubUrl = await resolveHubUrl(options);
    const client = new CalmHubClient(hubUrl);

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
        let result;
        if (options.id) {
            if (!options.version) {
                printError(0, '--version is required when --id is provided', 'push architecture', format);
                process.exit(1);
            }
            result = await client.pushArchitectureVersion(
                options.namespace,
                parseInt(options.id, 10),
                options.version,
                options.name,
                options.description ?? '',
                fileContent
            );
        } else {
            result = await client.pushArchitecture(
                options.namespace,
                options.name!,
                options.description ?? '',
                fileContent
            );
        }

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
    } catch (err) {
        handleHubError(err, format);
    }
}

// ── pull architecture ─────────────────────────────────────────────────────────

export interface PullArchitectureOptions {
    calmHubUrl?: string;
    namespace: string;
    id: string;
    version: string;
    output?: string;
}

export async function runPullArchitecture(options: PullArchitectureOptions): Promise<void> {
    const hubUrl = await resolveHubUrl(options);
    const client = new CalmHubClient(hubUrl);

    try {
        const result = await client.pullArchitecture(options.namespace, parseInt(options.id, 10), options.version);
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
    calmHubUrl?: string;
    namespace: string;
    format?: string;
}

export async function runListArchitectures(options: ListArchitecturesOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const hubUrl = await resolveHubUrl(options);
    const client = new CalmHubClient(hubUrl);

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
    calmHubUrl?: string;
    name: string;
    description?: string;
    format?: string;
}

export async function runCreateNamespace(options: CreateNamespaceOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const hubUrl = await resolveHubUrl(options);
    const client = new CalmHubClient(hubUrl);

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
    calmHubUrl?: string;
    format?: string;
}

export async function runListNamespaces(options: ListNamespacesOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const hubUrl = await resolveHubUrl(options);
    const client = new CalmHubClient(hubUrl);

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
    if (err instanceof HubClientError) {
        printError(err.status, err.error, err.request, format);
    } else {
        printError(0, err instanceof Error ? err.message : String(err), 'unknown', format);
    }
    process.exit(1);
}
