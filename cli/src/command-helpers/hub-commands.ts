import { readFile, writeFile } from 'fs/promises';
import { CalmHubClient, CalmHubOptions, HubClientError, HubDomainSummary, HubControlSummary, HubDomainCreateResult, DocumentMetadata, extractDocumentMetadata, computeSemVerBump, sortSemVer, latestReleaseVersion, isSnapshotVersion, toReleaseVersion, toSnapshotVersion, ResourceChangeType, ResourceType, updateDocumentMetadata, constructDocumentId, constructControlDocumentId, ControlDocumentMetadata, ControlDocumentKind, extractControlMetadata, updateControlDocumentMetadata, canonicalEqual, HubExtension, HubExtensionCommand, HubExtensionRoute, numberText } from '@finos/calm-shared';
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
 * Compare a (already normalised) local document against what CALM Hub has published, for the
 * `--fail-if-modified` strict-push paths.
 *
 * `localNormalised` must be the local file already rewritten the way Hub would store it at the
 * version being compared (via `updateDocumentMetadata` / `updateControlDocumentMetadata`), so that
 * version-only or default-field (e.g. `description`) differences are not seen as content changes.
 *
 * Throws a `HubCommandError` when `published` is missing/empty (e.g. a 200 with an empty body),
 * rather than letting that masquerade as a content change.
 *
 * @returns `true` when the documents are equal, `false` when the local document has changed.
 */
function isUnchangedFromPublished(localNormalised: string, published: unknown, mapping: string, requestLabel: string): boolean {
    if (!published || typeof published !== 'object' || Object.keys(published).length === 0) {
        throw new HubCommandError(
            0,
            `Could not read the latest published version of '${mapping}' from CALM Hub to compare against (empty response).`,
            requestLabel
        );
    }
    return canonicalEqual(JSON.parse(localNormalised), published);
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
    const hasRelease = mappedResourceVersions.some(version => !isSnapshotVersion(version));

    // override name/description if set
    const newDocumentMetadata = {
        ...metadata,
        name,
        description
    };
    if (isSnapshotVersion(metadata.version)) {
        return pushSnapshot(client, namespace, mappedResourceVersions, newDocumentMetadata, fileContent, options);
    }

    if (hasRelease) {
        const latestVersion = latestReleaseVersion(mappedResourceVersions);

        if (options.failIfModified) {
            // Strict mode: don't auto-bump. Compare the local document to the latest published
            // version — skip when unchanged, fail when it differs.
            const latest = await client.getMappedResourceByVersion(namespace, mapping, latestVersion, resourceType);
            // Normalise the local document to how Hub would have stored it at the latest version
            // (same $id/version, and default fields such as description applied) so a version-only
            // or absent-description difference is not mistaken for a content change.
            const localAtLatest = updateDocumentMetadata(fileContent, { ...newDocumentMetadata, version: latestVersion });
            const requestLabel = `push ${resourceType} ${options.file}`;
            if (isUnchangedFromPublished(localAtLatest, latest, mapping, requestLabel)) {
                newDocumentMetadata.version = latestVersion;
                return { action: 'skipped', metadata: newDocumentMetadata };
            }
            throw new HubCommandError(
                0,
                `Document '${mapping}' has changed relative to the latest published version (${latestVersion}) in CALM Hub. ` +
                'Re-run without --fail-if-modified (optionally with --change-type) to publish a new version.',
                requestLabel
            );
        }

        const newVersion = computeSemVerBump(latestVersion, changeType);
        assertNoSnapshotDeleted(mappedResourceVersions, metadata.version, newVersion, mapping, `push ${resourceType} ${options.file}`);
        newDocumentMetadata.version = newVersion;
        fileContent = updateDocumentMetadata(fileContent, newDocumentMetadata);
        await client.createMappedResourceVersion(newDocumentMetadata, fileContent);
    } else {
        // With only snapshots, the first release is the highest snapshot's.
        const snapshots = sortSemVer(mappedResourceVersions);
        const newVersion = snapshots.length > 0 ? toReleaseVersion(snapshots[snapshots.length - 1]) : '1.0.0';
        assertNoSnapshotDeleted(mappedResourceVersions, metadata.version, newVersion, mapping, `push ${resourceType} ${options.file}`);
        newDocumentMetadata.version = newVersion;
        fileContent = updateDocumentMetadata(fileContent, newDocumentMetadata);
        await client.createMappedResourceVersion(newDocumentMetadata, fileContent);
    }
    return { action: 'created', metadata: newDocumentMetadata };
}

/**
 * CalmHub deletes `V-SNAPSHOT` when `V` is published, and cannot restore it. `hub push` picks the
 * release version itself, so it publishes over a snapshot only when the document declares that
 * version: that is a deliberate release of the snapshot.
 */
function assertNoSnapshotDeleted(existingVersions: string[], localVersion: string, newVersion: string, mapping: string, requestLabel: string): void {
    const snapshot = toSnapshotVersion(newVersion);
    if (existingVersions.includes(snapshot) && localVersion !== newVersion) {
        throw new HubCommandError(
            0,
            `Publishing ${newVersion} of '${mapping}' deletes ${snapshot} in CALM Hub. ` +
            `Set the document version to ${newVersion} to release that snapshot, or use a different --change-type.`,
            requestLabel
        );
    }
}

/**
 * A snapshot is mutable, so it is pushed at its own version and never bumped. CalmHub overwrites
 * an existing snapshot in place; an unchanged one is skipped, as each POST is an audit update.
 * `--fail-if-modified` does not apply.
 */
async function pushSnapshot(
    client: CalmHubClient,
    namespace: string,
    existingVersions: string[],
    metadata: DocumentMetadata,
    fileContent: string,
    options: PushOptions): Promise<PushDocumentResult> {

    const normalised = updateDocumentMetadata(fileContent, metadata);
    if (existingVersions.includes(metadata.version)) {
        const published = await client.getMappedResourceByVersion(namespace, metadata.mapping, metadata.version, metadata.type);
        const requestLabel = `push ${metadata.type} ${options.file}`;
        if (isUnchangedFromPublished(normalised, published, metadata.mapping, requestLabel)) {
            return { action: 'skipped', metadata };
        }
    }
    await client.createMappedResourceVersion(metadata, normalised);
    return { action: 'created', metadata };
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
    // The version lookup uses `resourceType` but the POST URL comes from the `$id`, so a
    // mismatch would publish the document under its `$id` type.
    if (metadata.type !== resourceType) {
        printError(0, `Document $id is for ${metadata.type}, but this command pushes ${resourceType}: ${options.file}`, requestedCommand, format);
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

// ── personal namespace ───────────────────────────────────────────────────────

export interface PersonalNamespaceOptions {
    calmHubOptions: CalmHubOptions;
    format?: string;
}

/**
 * Shows the caller's personal namespace and whether they own it.
 * @param options Command options.
 */
export async function runWhoami(options: PersonalNamespaceOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const personal = await client.getPersonalNamespace();
        if (format === 'pretty') {
            const state = !personal.exists ? 'Not created' : personal.owned ? 'Yours' : 'Held by another user';
            printTableSuccess(
                [{ NAMESPACE: personal.name, STATE: state }],
                [
                    { key: 'NAMESPACE', header: 'PERSONAL NAMESPACE' },
                    { key: 'STATE', header: 'STATE' }
                ]
            );
        } else {
            printJsonSuccess(personal);
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

/**
 * Creates the caller's personal namespace. Does nothing when the caller already owns it.
 * @param options Command options.
 */
export async function runCreateMyNamespace(options: PersonalNamespaceOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const result = await client.createPersonalNamespace();
        if (format === 'pretty') {
            printTableSuccess(
                [{ STATUS: result.created ? 'Created' : 'Exists', NAME: result.name, LOCATION: result.location }],
                [
                    { key: 'STATUS', header: 'STATUS' },
                    { key: 'NAME', header: 'NAME' },
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

// ── push interface ────────────────────────────────────────────────────────────

/**
 * Pushes a new interface or a versioned update to CALM Hub.
 * @param options Command options.
 */
export async function runPushInterface(options: PushOptions): Promise<void> {
    return orchestratePush(options, 'interfaces');
}

// ── pull interface ────────────────────────────────────────────────────────────

/**
 * Pulls an interface version from CALM Hub and writes it to stdout or a file.
 * @param options Command options.
 */
export async function runPullInterface(options: PullOptions): Promise<void> {
    return await pullDocument(options, 'interfaces');
}

// ── list interfaces ───────────────────────────────────────────────────────────

/**
 * Lists interfaces in a namespace.
 * @param options Command options.
 */
export async function runListInterfaces(options: ListOptions): Promise<void> {
    return runListMappedResources(options, 'interfaces');
}

// ── push flow ─────────────────────────────────────────────────────────────────

/**
 * Pushes a new flow or a versioned update to CALM Hub.
 * @param options Command options.
 */
export async function runPushFlow(options: PushOptions): Promise<void> {
    return orchestratePush(options, 'flows');
}

// ── pull flow ─────────────────────────────────────────────────────────────────

/**
 * Pulls a flow version from CALM Hub and writes it to stdout or a file.
 * @param options Command options.
 */
export async function runPullFlow(options: PullOptions): Promise<void> {
    return await pullDocument(options, 'flows');
}

// ── list flows ────────────────────────────────────────────────────────────────

/**
 * Lists flows in a namespace.
 * @param options Command options.
 */
export async function runListFlows(options: ListOptions): Promise<void> {
    return runListMappedResources(options, 'flows');
}

// ── push timeline ─────────────────────────────────────────────────────────────

/**
 * Pushes a new timeline or a versioned update to CALM Hub.
 * @param options Command options.
 */
export async function runPushTimeline(options: PushOptions): Promise<void> {
    return orchestratePush(options, 'timelines');
}

// ── pull timeline ─────────────────────────────────────────────────────────────

/**
 * Pulls a timeline version from CALM Hub and writes it to stdout or a file.
 * @param options Command options.
 */
export async function runPullTimeline(options: PullOptions): Promise<void> {
    return await pullDocument(options, 'timelines');
}

// ── list timelines ────────────────────────────────────────────────────────────

/**
 * Lists timelines in a namespace.
 * @param options Command options.
 */
export async function runListTimelines(options: ListOptions): Promise<void> {
    return runListMappedResources(options, 'timelines');
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
    /** See {@link PushOptions.failIfModified}. */
    failIfModified?: boolean;
}

export interface ControlPushResult {
    status: PushAction;
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
            STATUS: result.status === 'created' ? 'Created' : 'Unchanged',
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

        const controlLabel = metadata.configName ? `${metadata.controlName}/${metadata.configName}` : metadata.controlName;

        if (options.failIfModified && existingVersions.length > 0) {
            // Strict mode: don't auto-bump. Compare the local document to the latest published
            // version — skip when unchanged, fail when it differs.
            const latestVersion = sortSemVer(existingVersions)[existingVersions.length - 1];
            const latest = kind === 'configuration'
                ? await client.getControlConfigurationVersion(metadata.domain, metadata.controlName, metadata.configName!, latestVersion)
                : await client.getControlRequirementVersion(metadata.domain, metadata.controlName, latestVersion);
            const localAtLatest = updateControlDocumentMetadata(fileContent, { ...metadata, version: latestVersion });
            if (isUnchangedFromPublished(localAtLatest, latest, controlLabel, requestedCommand)) {
                printControlPushResult({
                    status: 'skipped',
                    domain: metadata.domain,
                    controlName: metadata.controlName,
                    configName: metadata.configName,
                    version: latestVersion,
                    location: constructControlDocumentId({ ...metadata, version: latestVersion })
                }, format);
                return;
            }
            throw new HubCommandError(
                0,
                `Control ${kind} '${controlLabel}' has changed relative to the latest published version (${latestVersion}) in CALM Hub. ` +
                'Re-run without --fail-if-modified (optionally with --change-type) to publish a new version.',
                requestedCommand
            );
        }

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
            status: 'created',
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

// ── extensions ────────────────────────────────────────────────────────────────

const EXTENSIONS_REQUEST = 'GET /api/calm/extensions';

export interface ListExtensionsOptions {
    calmHubOptions: CalmHubOptions;
    format?: string;
}

export interface DescribeExtensionOptions {
    calmHubOptions: CalmHubOptions;
    id: string;
    command?: string;
    format?: string;
}

export interface RunExtensionCommandOptions {
    calmHubOptions: CalmHubOptions;
    id: string;
    command: string;
    /** A file path, or `-` for stdin. */
    input?: string;
    /** `key=value` pairs that set top-level input properties. */
    args?: string[];
    /** Seconds to wait for the reply. With none, CALM Hub ends the call at the timeout of the extension. */
    timeout?: string;
    format?: string;
}

/**
 * Lists the extensions that CALM Hub enabled, with their command names.
 * @param options Command options.
 */
export async function runListExtensions(options: ListExtensionsOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const extensions = await client.listExtensions();
        if (format === 'pretty') {
            printTableSuccess(
                extensions.map(e => ({
                    ID: e.id, VERSION: e.version ?? '', NAME: e.name ?? '', COMMANDS: Object.keys(e.commands ?? {}).join(', ')
                })),
                [
                    { key: 'ID', header: 'ID' },
                    { key: 'VERSION', header: 'VERSION' },
                    { key: 'NAME', header: 'NAME' },
                    { key: 'COMMANDS', header: 'COMMANDS' }
                ]
            );
        } else {
            printJsonSuccess(extensions);
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

/**
 * Shows an extension, or one of its commands with the method, path and scope of its route.
 * @param options Command options.
 */
export async function runDescribeExtension(options: DescribeExtensionOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const extension = await findExtension(client, options.id);
        if (options.command === undefined) {
            printExtension(extension, format);
        } else {
            printExtensionCommand(describeCommand(extension, options.command), format);
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

/**
 * Runs an extension command through the CALM Hub proxy and prints the reply. The proxy does not
 * validate the input (only MCP does), so the extension does, and its error is printed as Hub sent it.
 * @param options Command options.
 */
export async function runExtensionCommand(options: RunExtensionCommandOptions): Promise<void> {
    const format: OutputFormat = parseOutputFormat(options.format);
    const request = `ext ${options.id} ${options.command}`;
    const input = await readExtensionInput(options.input, request, format);
    const args = parseExtensionArgs(options.args ?? [], request, format);
    const timeoutMs = parseExtensionTimeout(options.timeout, request, format);
    const calmHubOptions = await handleOptionsLoadError(options.calmHubOptions, format);
    const client = new CalmHubClient(calmHubOptions);

    try {
        const extension = await findExtension(client, options.id);
        const { command, route } = findCommand(extension, options.command);
        for (const [key, value] of args) {
            input[key] = coerceArg(value, command.input?.['properties'], key);
        }
        const reply = await client.callExtension(extension, route, input, { timeoutMs });
        if (typeof reply.data === 'string') {
            if (reply.data !== '') {
                process.stdout.write(reply.data.endsWith('\n') ? reply.data : `${reply.data}\n`);
            }
        } else {
            printJsonSuccess(reply.data);
        }
    } catch (err) {
        handleHubError(err, format);
    }
}

interface DescribedExtensionCommand extends HubExtensionCommand {
    extension: string;
    command: string;
    method: string;
    path: string;
    scope: string;
    readOnly: boolean;
}

async function findExtension(client: CalmHubClient, id: string): Promise<HubExtension> {
    const extension = (await client.listExtensions()).find(e => e.id === id);
    if (!extension) {
        throw new HubCommandError(404, `Extension '${id}' is not enabled on this CALM Hub`, EXTENSIONS_REQUEST);
    }
    return extension;
}

function findCommand(extension: HubExtension, name: string): { command: HubExtensionCommand, route: HubExtensionRoute } {
    const commands = extension.commands ?? {};
    const command = Object.prototype.hasOwnProperty.call(commands, name) ? commands[name] : undefined;
    if (!command) {
        const known = Object.keys(commands);
        throw new HubCommandError(
            404,
            `Extension '${extension.id}' has no command '${name}' that this CALM Hub can run. `
            + (known.length > 0 ? `Commands: ${known.join(', ')}` : 'It has no commands.'),
            EXTENSIONS_REQUEST
        );
    }
    const route = extension.routes?.find(r => r.id === command.route);
    if (!route) {
        throw new HubCommandError(0, `Command '${name}' names route '${command.route}', which extension '${extension.id}' does not list`, EXTENSIONS_REQUEST);
    }
    return { command, route };
}

function describeCommand(extension: HubExtension, name: string): DescribedExtensionCommand {
    const { command, route } = findCommand(extension, name);
    return {
        extension: extension.id,
        command: name,
        ...command,
        method: route.method,
        path: route.path,
        scope: route.scope,
        // As the MCP readOnlyHint: Hub treats every GET as a read.
        readOnly: route.method.toUpperCase() === 'GET' || route.readOnly === true,
    };
}

function printExtension(extension: HubExtension, format: OutputFormat): void {
    if (format !== 'pretty') {
        printJsonSuccess(extension);
        return;
    }
    console.log(`${extension.name ?? extension.id} (${extension.id}${extension.version ? ` ${extension.version}` : ''})`);
    if (extension.description) {
        console.log(extension.description);
    }
    console.log('');
    const routes = extension.routes ?? [];
    printTableSuccess(
        Object.entries(extension.commands ?? {}).map(([name, command]) => {
            const route = routes.find(r => r.id === command.route);
            return {
                COMMAND: name,
                METHOD: route?.method ?? '',
                PATH: route?.path ?? '',
                DESCRIPTION: command.description ?? ''
            };
        }),
        [
            { key: 'COMMAND', header: 'COMMAND' },
            { key: 'METHOD', header: 'METHOD' },
            { key: 'PATH', header: 'PATH' },
            { key: 'DESCRIPTION', header: 'DESCRIPTION' }
        ]
    );
}

function printExtensionCommand(command: DescribedExtensionCommand, format: OutputFormat): void {
    if (format !== 'pretty') {
        printJsonSuccess(command);
        return;
    }
    printTableSuccess(
        (['command', 'description', 'method', 'path', 'scope', 'readOnly', 'destructive', 'idempotent'] as const)
            .filter(field => command[field] !== undefined)
            .map(field => ({ FIELD: field, VALUE: String(command[field]) })),
        [
            { key: 'FIELD', header: 'FIELD' },
            { key: 'VALUE', header: 'VALUE' }
        ]
    );
    console.log('\nInput schema:');
    console.log(JSON.stringify(command.input ?? {}, null, 2));
    if (command.output) {
        console.log('\nOutput schema:');
        console.log(JSON.stringify(command.output, null, 2));
    }
}

async function readExtensionInput(source: string | undefined, request: string, format: OutputFormat): Promise<Record<string, unknown>> {
    if (source === undefined) {
        return {};
    }
    const content = source === '-' ? await readStdin() : await loadFileContent(source, request, format);
    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        printError(0, `Input is not valid JSON: ${source === '-' ? 'stdin' : source}`, request, format);
        process.exit(1);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        printError(0, 'Input must be a JSON object', request, format);
        process.exit(1);
    }
    return parsed as Record<string, unknown>;
}

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
}

function parseExtensionArgs(args: string[], request: string, format: OutputFormat): [string, string][] {
    return args.map(arg => {
        const separator = arg.indexOf('=');
        if (separator <= 0) {
            printError(0, `--arg must have the form key=value: ${arg}`, request, format);
            process.exit(1);
        }
        const key = arg.slice(0, separator);
        // Assigning __proto__ would set the prototype of the input, so the value would be lost.
        if (key === '__proto__') {
            printError(0, '--arg cannot set __proto__. Use --input to send it', request, format);
            process.exit(1);
        }
        return [key, arg.slice(separator + 1)];
    });
}

// Node runs a timer above 2^31-1 ms after 1 ms, which would stop waiting at once.
const MAX_TIMEOUT_SECONDS = 2147483;
const DECIMAL_SECONDS = /^(\d+(\.\d*)?|\.\d+)$/;

function parseExtensionTimeout(timeout: string | undefined, request: string, format: OutputFormat): number | undefined {
    if (timeout === undefined) {
        return undefined;
    }
    const seconds = Number(timeout);
    if (!DECIMAL_SECONDS.test(timeout.trim()) || seconds <= 0 || seconds > MAX_TIMEOUT_SECONDS) {
        printError(0, `--timeout must be a positive number of seconds: ${timeout}`, request, format);
        process.exit(1);
    }
    return Math.ceil(seconds * 1000);
}

/**
 * Converts an `--arg` value to the type that the input schema declares for the property, so that
 * `--arg limit=5` sends a number. A value that does not convert stays a string. The REST proxy does
 * not check the input, so the extension must reject it. A number converts only when it is in the form
 * that it is sent in and is finite, so that `0x10`, `1e3` and an integer above 2^53 do not change value, and so
 * that JSON does not send `NaN` or `Infinity` as `null`.
 */
function coerceArg(value: string, properties: unknown, key: string): unknown {
    const schema = properties && typeof properties === 'object' && Object.prototype.hasOwnProperty.call(properties, key)
        ? (properties as Record<string, { type?: unknown }>)[key]
        : undefined;
    const declared = schema?.type;
    const types = Array.isArray(declared) ? declared : [declared];
    if (declared === undefined || types.includes('string')) {
        return value;
    }
    if (types.includes('integer') || types.includes('number')) {
        const number = Number(value);
        if (Number.isFinite(number) && numberText(number) === value.trim() && (types.includes('number') || Number.isSafeInteger(number))) {
            return number;
        }
    }
    if (types.includes('boolean') && (value === 'true' || value === 'false')) {
        return value === 'true';
    }
    if (types.some(t => t === 'object' || t === 'array' || t === 'null')) {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    return value;
}

// ── shared error handler ──────────────────────────────────────────────────────

/**
 * Normalizes and prints Hub errors, then exits the process.
 * @param err Thrown error.
 * @param format Output format selector.
 */
function handleHubError(err: unknown, format: OutputFormat): never {
    if (err instanceof HubClientError && err.body !== undefined) {
        printError(err.status, err.error, err.request, format, err.body);
    } else if (err instanceof HubClientError || err instanceof HubCommandError) {
        printError(err.status, err.error, err.request, format);
    } else {
        printError(0, err instanceof Error ? err.message : String(err), 'unknown', format);
    }
    process.exit(1);
}
