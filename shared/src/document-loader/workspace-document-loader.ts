import { CalmDocumentType, DocumentLoader, DocumentLoadError } from './document-loader';
import { initLogger, Logger } from '../logger';
import { readFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { SchemaDirectory } from '../schema-directory';
import path from 'path';

// Mirrors MANIFEST_FILENAME in the CLI workspace bundle module.
const MANIFEST_FILENAME = 'workspace-manifest.json';

/**
 * Identity of a single tracked workspace document, used to decide whether an
 * incoming reference points at it.
 */
interface WorkspaceRule {
    /** Manifest key — the bare id a reference may use (e.g. "workshop-pattern"). */
    bareId: string;
    /** Absolute path to the document on disk. */
    localPath: string;
    /** The document's `$id`, if it declares one (often a full CalmHub URL). */
    docId?: string;
    /** `$id` with any `/versions/<v>` suffix stripped, for version-agnostic matching. */
    basePath?: string;
}

/**
 * Strip a trailing `/versions/<version>` segment from a CalmHub-style path.
 * Returns the base path, or null when there is no version segment.
 */
export function stripVersionSuffix(ref: string): string | null {
    const m = ref.match(/^(.+?)\/versions\/[^/#]+/);
    return m ? m[1] : null;
}

/**
 * A document loader backed by a local CALM workspace bundle.
 *
 * It treats the working copies tracked in the bundle manifest as the highest-priority
 * source of truth: any reference to a tracked document — by bare id, by its `$id`, by a
 * differently-versioned CalmHub path, or by full URL — resolves to the local file,
 * overriding CalmHub. References it does not recognise fall through to the next loader.
 */
export class WorkspaceDocumentLoader implements DocumentLoader {
    private readonly logger: Logger;
    private readonly bundlePath: string;
    private readonly rules: WorkspaceRule[];

    /**
     * @param bundlePath Absolute path to the workspace bundle directory (contains the manifest)
     * @param debug Enable debug logging
     */
    constructor(bundlePath: string, debug: boolean = false) {
        this.logger = initLogger(debug, 'workspace-document-loader');
        this.bundlePath = bundlePath;
        this.rules = this.buildRules();
        this.logger.debug(`Initialised with bundlePath: ${bundlePath}, tracked documents: ${this.rules.length}`);
    }

    /**
     * Read the bundle manifest and each tracked file once, building the set of identities
     * (bare id, `$id`, versioned base path) that should resolve to each local document.
     */
    private buildRules(): WorkspaceRule[] {
        const manifestPath = path.join(this.bundlePath, MANIFEST_FILENAME);
        if (!existsSync(manifestPath)) {
            this.logger.debug(`No workspace manifest at ${manifestPath}`);
            return [];
        }

        let manifest: Record<string, unknown>;
        try {
            manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        } catch (err) {
            this.logger.warn(`Failed to read workspace manifest ${manifestPath}: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }

        const rules: WorkspaceRule[] = [];
        for (const [bareId, value] of Object.entries(manifest)) {
            // Manifest entries are `{ path, type, ... }`; tolerate the legacy plain-string form too.
            const relPath = typeof value === 'string'
                ? value
                : (value && typeof value === 'object' && typeof (value as { path?: unknown }).path === 'string'
                    ? (value as { path: string }).path
                    : undefined);
            if (!relPath) continue;

            const localPath = path.isAbsolute(relPath) ? relPath : path.resolve(this.bundlePath, relPath);
            const rule: WorkspaceRule = { bareId, localPath };

            if (existsSync(localPath)) {
                try {
                    const json = JSON.parse(readFileSync(localPath, 'utf8'));
                    const docId = json?.['$id'];
                    if (typeof docId === 'string' && docId.trim()) {
                        rule.docId = docId;
                        rule.basePath = stripVersionSuffix(docId) ?? undefined;
                    }
                } catch (err) {
                    this.logger.warn(`Could not parse tracked document '${bareId}' at ${localPath}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            rules.push(rule);
        }
        return rules;
    }

    /**
     * Find the local file path for a reference, or undefined if no tracked document matches.
     * Matches a bare id, an exact `$id`, a differently-versioned CalmHub path, or a full URL.
     */
    private resolveRule(reference: string): string | undefined {
        const fragmentIdx = reference.indexOf('#');
        const baseRef = fragmentIdx >= 0 ? reference.slice(0, fragmentIdx) : reference;

        for (const rule of this.rules) {
            // Bare id match
            if (baseRef === rule.bareId) return rule.localPath;
            // Exact `$id` match
            if (rule.docId && baseRef === rule.docId) return rule.localPath;

            if (rule.basePath) {
                // Same CalmHub path at a different version
                const stripped = stripVersionSuffix(baseRef);
                if (stripped !== null && stripped === rule.basePath) return rule.localPath;

                // Full URL form — compare only the path portion
                if (baseRef.startsWith('http://') || baseRef.startsWith('https://')) {
                    try {
                        const pathBase = stripVersionSuffix(new URL(baseRef).pathname);
                        if (pathBase !== null && pathBase === rule.basePath) return rule.localPath;
                    } catch {
                        // not a valid URL — ignore
                    }
                }
            }
        }
        return undefined;
    }

    /**
     * Pre-load every tracked document into the schema directory, keyed by both its `$id` and
     * its bare id, so `$ref` resolution during schema compilation uses the local working copy.
     */
    async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
        this.logger.debug('Pre-loading workspace documents...');
        for (const rule of this.rules) {
            if (!existsSync(rule.localPath)) {
                this.logger.warn(`Tracked document '${rule.bareId}' not found at ${rule.localPath}`);
                continue;
            }
            try {
                const document = JSON.parse(await readFile(rule.localPath, 'utf8'));
                if (rule.docId) schemaDirectory.storeDocument(rule.docId, 'schema', document);
                schemaDirectory.storeDocument(rule.bareId, 'schema', document);
                this.logger.debug(`Pre-loaded workspace document '${rule.bareId}' from ${rule.localPath}`);
            } catch (err) {
                this.logger.warn(`Failed to pre-load '${rule.bareId}': ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }

    async loadMissingDocument(documentId: string, _type: CalmDocumentType): Promise<object> {
        const localPath = this.resolveRule(documentId);
        if (localPath === undefined) {
            // Not a tracked document — let other loaders (e.g. CalmHub) try.
            throw new DocumentLoadError({
                name: 'OPERATION_NOT_IMPLEMENTED',
                message: `WorkspaceDocumentLoader cannot resolve: ${documentId}`
            });
        }

        this.logger.debug(`Resolved via workspace bundle: ${documentId} -> ${localPath}`);
        // The reference matched a tracked document, so any failure from here is fatal: a later
        // loader would only fetch a stale remote copy and mask the local problem.
        if (!existsSync(localPath)) {
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `Tracked workspace document file not found: ${localPath}`,
                recoverable: false
            });
        }
        try {
            return JSON.parse(await readFile(localPath, 'utf8'));
        } catch (err) {
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `Failed to load/parse workspace document ${localPath}: ${err instanceof Error ? err.message : String(err)}`,
                cause: err instanceof Error ? err : undefined,
                recoverable: false
            });
        }
    }

    resolvePath(reference: string): string | undefined {
        return this.resolveRule(reference);
    }
}
