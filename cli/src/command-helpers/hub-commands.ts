import { readFile, writeFile } from 'fs/promises';
import { CalmHubClient, CalmHubOptions, HubClientError, HubDomainSummary, HubControlSummary, HubDomainCreateResult, DocumentMetadata, extractDocumentMetadata, computeSemVerBump, sortSemVer, ResourceChangeType, ResourceType, updateDocumentMetadata, constructDocumentId, ControlDocumentMetadata, ControlDocumentKind, extractControlMetadata, updateControlDocumentMetadata, canonicalEqual } from '@finos/calm-shared';
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
        options.authPlugin = await cliConfig.loadAuthPlugin(config.authPluginPath, false);
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

export interface PushOptions {
    calmHubOptions: CalmHubOptions;
    name?: string;
    description?: string;
    file: string;
    version?: string;
    format?: string;
    changeType?: ResourceChangeType;
    /**
     * Strict mode. When set, push does not auto-bump: if the mapping already exists, the local
     * document is compared to the latest published version. Unchanged content is skipped; changed
     * content fails the push (so a merge introduces only the versions it claims). A brand-new
     * mapping is still created at 1.0.0.
     */
    failIfModified?: boolean;
}

/** Whether a push created a new version or skipped because the content was unchanged. */
export type PushAction = 'created' | 'skipped';

export interface PushResult {
    status: PushAction;
    version: string;
    mapping: string;
    namespace: string;
    location: string;
}

export interface PushDocumentResult {
    action: PushAction;
    metadata: DocumentMetadata;
}

/**
 * Prints a push operation result in either pretty table or JSON format.
 * @param result Push result payload.
 * @param format Output format selector.
 */
export function printPushResult(result: PushResult, format: OutputFormat): void {
    if (format === 'pretty') {
        const statusLabel = result.status === 'created' ? 'Created' : 'Unchanged';
        printTableSuccess(
            [{ STATUS: statusLabel, MAPPING: result.mapping, VERSION: result.version, LOCATION: result.location }],
            [
                { key: 'STATUS', header: 'STATUS' },
                { key: 'MAPPING', header: 'MAPPING' },
                { key: 'VERSION', header: 'VERSION' },
                { key: 'LOCATION', header: 'LOCATION' }
            ]
        );
    } else {
        printJsonSuccess(result);
    }
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
 * Handles errors from hub operations and exits with formatted error output.
 * @param filePath The path to the file to load.
 * @param requestedCommand The command that requested this operation, used for error context.
 * @param format The format for the error message.
 * @returns The raw file as a UTF-8 string.
 */
export async function loadFileContent(filePath: string, requestedCommand: string, format: OutputFormat): Promise<string> {
    try {
        return await readFile(filePath, 'utf-8');
    } catch {
        printError(0, `Could not read file: ${filePath}`, requestedCommand, format);
        process.exit(1);
    }
}

/**
 * Validates and minifies JSON content.
 * @param fileContent The raw file content.
 * @param filePath The path to the file.
 * @param requestedCommand The command that requested this operation.
 * @param format The output format.
 * @returns The validated and minified JSON string.
 */
export function validateAndMinifyJSON(fileContent: string, filePath: string, requestedCommand: string, format: OutputFormat): string {
    try {
        const parsed = JSON.parse(fileContent);
        fileContent = JSON.stringify(parsed); // re-stringify to ensure consistent formatting for storage and comparison, and to catch any JSON issues before sending to the hub.
    } catch {
        printError(0, `File is not valid JSON: ${filePath}`, requestedCommand, format);
        process.exit(1);
    }
    return fileContent;
}

/**
 * Extracts document metadata, and exits with formatted error output on failure.
 * @param fileContent The raw file content.
 * @param requestedCommand The command that requested this operation.
 * @param format The output format.
 * @returns The extracted document metadata.
 */
export function handleMetadataParsing(fileContent: string, requestedCommand: string, format: OutputFormat) {
    let metadata: DocumentMetadata;
    try {
        metadata = extractDocumentMetadata(fileContent);
    } catch (error) {
        printError(0, `Failed to extract document metadata: ${error instanceof Error ? error.message : String(error)}`, requestedCommand, format);
        process.exit(1);
    }
    return metadata;
}

/**
 * Handles the actual push stage of the operation i.e. the integration with CalmHub.
 * Checks whether it already exists to determine whether to create a new mapping or update an existing one.
 * @param client The CalmHub client.
 * @param namespace The namespace for the document.
 * @param mapping The mapping for the document.
 * @param metadata The metadata for the document.
 * @param fileContent The content of the document.
 * @param resourceType The type of the resource.
 * @param changeType The type of change.
 * @param options The push options.
 * @param format The output format.
 * @returns A promise resolving to the metadata of the pushed document.
 */
export async function pushDocument(
    client: CalmHubClient, 
    namespace: string, 
    mapping: string, 
    metadata: DocumentMetadata, 
    fileContent: string, 
    resourceType: ResourceType,
    changeType: ResourceChangeType,
    options: PushOptions): Promise<PushDocumentResult> {

    // allow changing of name/description if not already set.
    const name = options.name ?? metadata.name;
    const description = options.description ?? metadata.description ?? '';

    // const resourceTypeString: string = resourceType;
    const mappedResourceVersions = await client.getMappedResourceVersions(namespace, mapping, resourceType);
    const mappingExists = mappedResourceVersions.length > 0;

    // override name/description if set
    const newDocumentMetadata = {
        ...metadata,
        name,
        description
    };
    if (mappingExists) {
        // Sort defensively so the highest version is last, regardless of the order Hub returns them in.
        const sortedVersions = sortSemVer(mappedResourceVersions);
        const latestVersion = sortedVersions[sortedVersions.length - 1];

        if (options.failIfModified) {
            // Strict mode: don't auto-bump. Compare the local document to the latest published
            // version — skip when unchanged, fail when it differs.
            const latest = await client.getMappedResourceByVersion(namespace, mapping, latestVersion, resourceType);
            if (canonicalEqual(JSON.parse(fileContent), latest)) {
                newDocumentMetadata.version = latestVersion;
                return { action: 'skipped', metadata: newDocumentMetadata };
            }
            throw new HubCommandError(
                0,
                `Document '${mapping}' has changed relative to the latest published version (${latestVersion}) in CALM Hub. ` +
                'Re-run without --fail-if-modified to publish a new version.',
                `push ${resourceType} ${options.file}`
            );
        }

        const newVersion = computeSemVerBump(latestVersion, changeType);
        newDocumentMetadata.version = newVersion;
        fileContent = updateDocumentMetadata(fileContent, newDocumentMetadata);
        await client.createMappedResourceVersion(newDocumentMetadata, fileContent);
    } else {
        newDocumentMetadata.version = '1.0.0';
        fileContent = updateDocumentMetadata(fileContent, newDocumentMetadata);
        await client.createMappedResourceVersion(newDocumentMetadata, fileContent);
    }
    return { action: 'created', metadata: newDocumentMetadata };
}

/**
 * Handle all the steps for pushing a document, which is the same for all document types:
 * - Setup client
 * - Load and validate the document
 * - Extract all necessary information
 * - Push to CalmHub
 * - Update the document on-disk with the new version and ID returned from CalmHub
 */
export async function orchestratePush(options: PushOptions, resourceType: ResourceType): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    const requestedCommand = `push ${resourceType} ${options.file}`;
    let fileContent = await loadFileContent(options.file, requestedCommand, format);

    // Validate the file is parseable JSON before sending
    fileContent = validateAndMinifyJSON(fileContent, options.file, requestedCommand, format);

    const metadata: DocumentMetadata = handleMetadataParsing(fileContent, requestedCommand, format);

    if (!metadata.namespace || !metadata.mapping) {
        printError(0, `Document metadata must include namespace and mapping: ${options.file}`, requestedCommand, format);
        process.exit(1);
    }
    const namespace = metadata.namespace;
    const mapping = metadata.mapping;

    try {
        const { action, metadata: documentMetadata } = await pushDocument(
            client,
            namespace,
            mapping,
            metadata,
            fileContent,
            resourceType,
            options.changeType ?? 'PATCH',
            options);
        // Only rewrite the on-disk document when a new version was actually created; an unchanged
        // document is left exactly as it is.
        if (action === 'created') {
            const newDocument = updateDocumentMetadata(fileContent, documentMetadata);
            await writeFile(options.file, newDocument, 'utf-8');
        }
        const result: PushResult = {
            status: action,
            mapping,
            version: documentMetadata.version!,
            namespace,
            location: constructDocumentId(documentMetadata)
        };
        printPushResult(result, format);
    } catch (err) {
        handleHubError(err, format);
    }
}

/**
 * Pushes a new architecture or a versioned update to CALM Hub.
 * @param options Command options.
 */
export async function runPushArchitecture(options: PushOptions): Promise<void> {
    return await orchestratePush(options, 'architectures');
}


// ── pull architecture ─────────────────────────────────────────────────────────

export interface PullOptions {
    calmHubOptions: CalmHubOptions;
    namespace: string;
    mapping: string;
    version?: string;
    output?: string;
}

export async function pullDocument(options: PullOptions, resourceType: ResourceType): Promise<void> {
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions);
    const client = new CalmHubClient(calmHubOptions);

    const mapping = options.mapping;
    const namespace = options.namespace;
    const version = options.version;
    const pullLatest = !version;

    console.error(`Pulling ${resourceType} from CALM Hub with namespace=${namespace}, mapping=${mapping}, version=${version ?? 'latest'}`);

    try {
        let result;
        if (pullLatest) {
            result = await client.getMappedResourceLatestVersion(namespace, mapping, resourceType);
        } else {
            result = await client.getMappedResourceByVersion(namespace, mapping, version, resourceType);
        }
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

/**
 * Pulls an architecture version from CALM Hub and writes it to stdout or a file.
 * @param options Command options.
 */
export async function runPullArchitecture(options: PullOptions): Promise<void> {
    return await pullDocument(options, 'architectures');
}

// ── list architectures ────────────────────────────────────────────────────────

export interface ListOptions {
    calmHubOptions: CalmHubOptions;
    namespace: string;
    format?: string;
}

/**
 * Lists the custom IDs of mapped resources of a given type in a namespace.
 * Backed by GET /calm/namespaces/{namespace}/{type}, which returns the list of mapped resource IDs.
 * @param options Command options.
 * @param resourceType The resource type to list.
 */
export async function runListMappedResources(options: ListOptions, resourceType: ResourceType): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const mappingIds = await client.getNamespaceMappings(options.namespace, resourceType);

        if (format === 'pretty') {
            printTableSuccess(
                mappingIds.map(mappingId => ({ MAPPING: mappingId })),
                [
                    { key: 'MAPPING', header: 'MAPPING' }
                ]
            );
        } else {
            printJsonSuccess(mappingIds);
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

/**
 * Lists architectures in a namespace.
 * @param options Command options.
 */
export async function runListArchitectures(options: ListOptions): Promise<void> {
    return runListMappedResources(options, 'architectures');
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

/**
 * Pushes a new pattern or a versioned update to CALM Hub.
 * @param options Command options.
 */
export async function runPushPattern(options: PushOptions): Promise<void> {
    return orchestratePush(options, 'patterns');
}

// ── pull pattern ──────────────────────────────────────────────────────────────

export interface PullPatternOptions {
    calmHubOptions: CalmHubOptions;
    namespace: string;
    version?: string;
    output?: string;
    mapping: string;
}

/**
 * Pulls a pattern version from CALM Hub and writes it to stdout or a file.
 * @param options Command options.
 */
export async function runPullPattern(options: PullOptions): Promise<void> {
    return await pullDocument(options, 'patterns');
}

// ── list patterns ─────────────────────────────────────────────────────────────

/**
 * Lists patterns in a namespace.
 * @param options Command options.
 */
export async function runListPatterns(options: ListOptions): Promise<void> {
    return runListMappedResources(options, 'patterns');
}

// ── push standard ─────────────────────────────────────────────────────────────

/**
 * Pushes a new standard or a versioned update to CALM Hub.
 * @param options Command options.
 */
export async function runPushStandard(options: PushOptions): Promise<void> {
    return orchestratePush(options, 'standards');
}

// ── pull standard ─────────────────────────────────────────────────────────────

/**
 * Pulls a standard version from CALM Hub and writes it to stdout or a file.
 * @param options Command options.
 */
export async function runPullStandard(options: PullOptions): Promise<void> {
    return await pullDocument(options, 'standards');
}

// ── list standards ────────────────────────────────────────────────────────────

/**
 * Lists standards in a namespace.
 * @param options Command options.
 */
export async function runListStandards(options: ListOptions): Promise<void> {
    return runListMappedResources(options, 'standards');
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

// ── push control documents ─────────────────────────────────────────────────────

export interface PushControlOptions {
    calmHubOptions: CalmHubOptions;
    file: string;
    format?: string;
    changeType?: ResourceChangeType;
}

export interface ControlPushResult {
    domain: string;
    controlName: string;
    configName?: string;
    version: string;
    location: string;
}

/**
 * Prints a control push result in either pretty table or JSON format.
 */
function printControlPushResult(result: ControlPushResult, format: OutputFormat): void {
    if (format === 'pretty') {
        const row: Record<string, string> = {
            STATUS: 'Created',
            DOMAIN: result.domain,
            CONTROL: result.controlName
        };
        const columns = [
            { key: 'STATUS', header: 'STATUS' },
            { key: 'DOMAIN', header: 'DOMAIN' },
            { key: 'CONTROL', header: 'CONTROL' }
        ];
        if (result.configName) {
            row.CONFIG = result.configName;
            columns.push({ key: 'CONFIG', header: 'CONFIG' });
        }
        row.VERSION = result.version;
        row.LOCATION = result.location;
        columns.push({ key: 'VERSION', header: 'VERSION' }, { key: 'LOCATION', header: 'LOCATION' });
        printTableSuccess([row], columns);
    } else {
        printJsonSuccess(result);
    }
}

/**
 * Pushes a control requirement or configuration document to CALM Hub.
 *
 * Mirrors the mapped-resource push flow: the domain, control (and config) names and
 * version are derived from the document $id; the next version is computed from the
 * existing versions and the change type (1.0.0 on first push); the $id is rewritten
 * with the new version and the raw document is POSTed to the versioned endpoint.
 */
async function orchestrateControlPush(options: PushControlOptions, kind: ControlDocumentKind): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    const requestedCommand = `push control-${kind} ${options.file}`;
    let fileContent = await loadFileContent(options.file, requestedCommand, format);
    fileContent = validateAndMinifyJSON(fileContent, options.file, requestedCommand, format);

    let metadata: ControlDocumentMetadata;
    try {
        metadata = extractControlMetadata(fileContent);
    } catch (error) {
        printError(0, `Failed to extract control document metadata: ${error instanceof Error ? error.message : String(error)}`, requestedCommand, format);
        process.exit(1);
    }

    if (metadata.kind !== kind) {
        printError(0, `Document $id describes a control ${metadata.kind}, but a control ${kind} was expected: ${options.file}`, requestedCommand, format);
        process.exit(1);
    }

    const changeType = options.changeType ?? 'PATCH';
    try {
        const existingVersions = kind === 'configuration'
            ? await client.getControlConfigurationVersions(metadata.domain, metadata.controlName, metadata.configName!)
            : await client.getControlRequirementVersions(metadata.domain, metadata.controlName);

        let newVersion = '1.0.0';
        if (existingVersions.length > 0) {
            const sorted = sortSemVer(existingVersions);
            newVersion = computeSemVerBump(sorted[sorted.length - 1], changeType);
        }

        const newMetadata: ControlDocumentMetadata = { ...metadata, version: newVersion };
        fileContent = updateControlDocumentMetadata(fileContent, newMetadata);

        const location = kind === 'configuration'
            ? await client.createControlConfigurationVersion(metadata.domain, metadata.controlName, metadata.configName!, newVersion, fileContent)
            : await client.createControlRequirementVersion(metadata.domain, metadata.controlName, newVersion, fileContent);

        await writeFile(options.file, fileContent, 'utf-8');

        printControlPushResult({
            domain: metadata.domain,
            controlName: metadata.controlName,
            configName: metadata.configName,
            version: newVersion,
            location
        }, format);
    } catch (err) {
        handleHubError(err, format);
    }
}

/**
 * Pushes a control requirement version to CALM Hub (derives addressing from the document $id).
 * @param options Command options.
 */
export async function runPushControlRequirement(options: PushControlOptions): Promise<void> {
    return orchestrateControlPush(options, 'requirement');
}

/**
 * Pushes a control configuration version to CALM Hub (derives addressing from the document $id).
 * @param options Command options.
 */
export async function runPushControlConfiguration(options: PushControlOptions): Promise<void> {
    return orchestrateControlPush(options, 'configuration');
}

// ── pull control documents ──────────────────────────────────────────────────────

export interface PullControlOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    controlName: string;
    configName?: string;
    version?: string;
    output?: string;
}

/**
 * Pulls a control requirement or configuration version and writes it to stdout or a file.
 * When no version is supplied, the highest available version is pulled.
 */
async function pullControlDocument(options: PullControlOptions, kind: ControlDocumentKind): Promise<void> {
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, 'json');
    const client = new CalmHubClient(calmHubOptions);

    const { domain, controlName, configName, version } = options;
    const pullLatest = !version;

    try {
        let resolvedVersion = version;
        if (pullLatest) {
            const versions = kind === 'configuration'
                ? await client.getControlConfigurationVersions(domain, controlName, configName!)
                : await client.getControlRequirementVersions(domain, controlName);
            if (versions.length === 0) {
                printError(0, `No control ${kind} versions found in domain ${domain} for control ${controlName}`, `pull control-${kind}`, 'json');
                process.exit(1);
            }
            const sorted = sortSemVer(versions);
            resolvedVersion = sorted[sorted.length - 1];
        }

        const result = kind === 'configuration'
            ? await client.getControlConfigurationVersion(domain, controlName, configName!, resolvedVersion!)
            : await client.getControlRequirementVersion(domain, controlName, resolvedVersion!);

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

/**
 * Pulls a control requirement version from CALM Hub.
 * @param options Command options.
 */
export async function runPullControlRequirement(options: PullControlOptions): Promise<void> {
    return pullControlDocument(options, 'requirement');
}

/**
 * Pulls a control configuration version from CALM Hub.
 * @param options Command options.
 */
export async function runPullControlConfiguration(options: PullControlOptions): Promise<void> {
    return pullControlDocument(options, 'configuration');
}

// ── list controls / configurations ──────────────────────────────────────────────

export interface ListControlsOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    format?: string;
}

/**
 * Lists the control names in a domain (single column / JSON array).
 * @param options Command options.
 */
export async function runListControls(options: ListControlsOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const controls: HubControlSummary[] = await client.listControls(options.domain);
        if (format === 'pretty') {
            printTableSuccess(
                controls.map(c => ({ NAME: c.name, ID: c.id ?? '', DESCRIPTION: c.description ?? '' })),
                [
                    { key: 'NAME', header: 'NAME' },
                    { key: 'ID', header: 'ID' },
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

export interface ListControlConfigurationsOptions {
    calmHubOptions: CalmHubOptions;
    domain: string;
    controlName: string;
    format?: string;
}

/**
 * Lists the configuration names for a named control (single column / JSON array).
 * @param options Command options.
 */
export async function runListControlConfigurations(options: ListControlConfigurationsOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const configurations: HubControlSummary[] = await client.listControlConfigurations(options.domain, options.controlName);
        if (format === 'pretty') {
            printTableSuccess(
                configurations.map(c => ({ NAME: c.name, ID: c.id ?? '', DESCRIPTION: c.description ?? '' })),
                [
                    { key: 'NAME', header: 'NAME' },
                    { key: 'ID', header: 'ID' },
                    { key: 'DESCRIPTION', header: 'DESCRIPTION' }
                ]
            );
        } else {
            printJsonSuccess(configurations);
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
