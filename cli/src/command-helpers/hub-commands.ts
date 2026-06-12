import { readFile, writeFile } from 'fs/promises';
import { CalmHubClient, CalmHubOptions, HubClientError, HubDomainSummary, HubControlRequirementSummary, HubDomainCreateResult, DocumentMetadata, extractDocumentMetadata, computeSemVerBump, ResourceChangeType, ResourceType, updateDocumentMetadata } from '@finos/calm-shared';
import { OutputFormat, parseOutputFormat, printError, printJsonSuccess, printTableSuccess } from './hub-output';
import * as cliConfig from '../cli-config';
import { version } from 'os';

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

export interface PushOptions {
    calmHubOptions: CalmHubOptions;
    namespace: string;
    name?: string;
    description?: string;
    file: string;
    version?: string;
    format?: string;
    changeType?: ResourceChangeType;
}

export interface PushResult {
    version: string;
    mapping: string;
    namespace: string;
    location: string;
}

/**
 * Prints a push operation result in either pretty table or JSON format.
 * @param result Push result payload.
 * @param format Output format selector.
 */
export function printPushResult(result: PushResult, format: OutputFormat): void {
    if (format === 'pretty') {
        printTableSuccess(
            [{ STATUS: 'Created', MAPPING: result.mapping, VERSION: result.version, LOCATION: result.location }],
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
export function validateAndMinifyJSON(fileContent: any, filePath: string, requestedCommand: string, format: OutputFormat): string {
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
        options: PushOptions, 
        format: OutputFormat): Promise<DocumentMetadata> {
    // const existingDocumentMetadata = extractDocumentMetadata(fileContent);

    // allow changing of name/description if not already set.
    const name = options.name ?? metadata.name;
    const description = options.description ?? metadata.description ?? '';

    // const resourceTypeString: string = resourceType;
    const mappedResourceVersions = await client.getMappedResourceVersions(namespace, mapping, resourceType);
    const mappingExists = mappedResourceVersions.length > 0;

    // override name/description if set
    let newDocumentMetadata = {
        ...metadata,
        name,
        description
    };
    if (mappingExists) {
        // TODO do these come back sorted? should we sort them just in case?
        const latestVersion = mappedResourceVersions[mappedResourceVersions.length - 1];
        const newVersion = computeSemVerBump(latestVersion, changeType);
        await client.createMappedResourceVersion(
            namespace, 
            mapping, 
            resourceType, 
            newVersion, 
            name, 
            description, 
            fileContent);
        newDocumentMetadata.version = newVersion;
    } else {
        // new mapping
        // if (!name) {
        //     printError(0, `--name is required when creating a new ${resourceTypeString}`, `push ${resourceTypeString}`, format);
        //     process.exit(1);
        // }

        // if (!description) {
        //     printError(0, `--description is required when creating a new ${resourceTypeString}`, `push ${resourceTypeString}`, format);
        //     process.exit(1);
        // }
        await client.createMappedResourceVersion(
            namespace,
            mapping,
            resourceType,
            '1.0.0',
            name,
            description,
            fileContent);
        newDocumentMetadata.version = "1.0.0";
    }
    return newDocumentMetadata;
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

    let metadata: DocumentMetadata = handleMetadataParsing(fileContent, requestedCommand, format);

    if (!metadata.namespace || !metadata.mapping) {
        printError(0, `Document metadata must include namespace and mapping: ${options.file}`, requestedCommand, format);
        process.exit(1);
    }
    const namespace = metadata.namespace;
    const mapping = metadata.mapping;

    let documentMetadata: DocumentMetadata;
    try {
        documentMetadata = await pushDocument(
            client, 
            namespace, 
            mapping, 
            metadata, 
            fileContent, 
            resourceType, 
            options.changeType ?? 'PATCH', 
            options, 
            format);
        // TODO logging
        console.log("Document version is now ", documentMetadata.version);
        const newDocument = updateDocumentMetadata(fileContent, documentMetadata);
        console.log("Updating document on file system with new version and id...");
        await writeFile(options.file, newDocument, 'utf-8');
        const result: PushResult = {
            mapping,
            version: documentMetadata.version!,
            namespace,
            location: documentMetadata.baseUrl
        }
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

    console.log(`Pulling ${resourceType} from CALM Hub with namespace=${namespace}, mapping=${mapping}, version=${version ?? 'latest'}`);

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
        const controls: HubControlRequirementSummary[] = await client.listControlRequirements(options.domain);

        if (format === 'pretty') {
            printTableSuccess(
                controls.map(c => ({
                    'CONTROL-ID': c['control-id'],
                    NAME: c.name,
                    DESCRIPTION: c.description ?? '',
                    VERSIONS: c.versions.join(', ')
                })),
                [
                    { key: 'CONTROL-ID', header: 'CONTROL-ID' },
                    { key: 'NAME', header: 'NAME' },
                    { key: 'DESCRIPTION', header: 'DESCRIPTION' },
                    { key: 'VERSIONS', header: 'VERSIONS' }
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
    configId: number;
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
            configurations.push({ configId: id, versions });
        }

        if (format === 'pretty') {
            printTableSuccess(
                configurations.map(configuration => ({
                    'CONFIG-ID': configuration.configId,
                    VERSIONS: configuration.versions.join(', ')
                })),
                [
                    { key: 'CONFIG-ID', header: 'CONFIG-ID' },
                    { key: 'VERSIONS', header: 'VERSIONS' }
                ]
            );
        } else {
            printJsonSuccess(configurations.map(c => ({ 'config-id': c.configId, versions: c.versions })));
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
