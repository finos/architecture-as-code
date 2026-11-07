import path from 'path';
import { readFile } from 'fs/promises';
import {
    classifyGitHubDocument,
    detectDirectorySegment,
    isControlDocumentId,
    isKnownGitHubDirectory,
    resourceTypeFromDocumentId,
    type GitHubResourceDirectory,
} from '@finos/calm-shared';
import { loadManifest, resolveFilePath, type WorkspaceManifest } from './bundle';
import { isNarrativeWorkspaceManifestEntry } from './document-kind';
import { findProjectRoot } from '../../workspace-resolver';

/**
 * Mapping from workspace manifest document types to canonical CALM Hub GitHub directories.
 */
const DOCUMENT_TYPE_TO_DIRECTORY: Record<string, GitHubResourceDirectory> = {
    architecture: 'architectures',
    pattern: 'patterns',
    schema: 'standards',
    flow: 'flows',
    interface: 'interfaces',
    control: 'controls',
    timeline: 'timelines',
    adr: 'adrs',
};

const DIRECTORY_TYPE_WITH_ARTICLE: Record<GitHubResourceDirectory, string> = {
    architectures: 'an architecture',
    patterns: 'a pattern',
    standards: 'a standard',
    flows: 'a flow',
    interfaces: 'an interface',
    controls: 'a control',
    adrs: 'an adr',
    timelines: 'a timeline',
    decorators: 'a decorator',
};

export interface WorkspaceLayoutWarning {
    id: string;
    filePath: string;
    expectedDirectory: string;
    actualDirectory?: string;
    typeSegment?: string;
    message: string;
}

/**
 * Extract the type segment from a conformant CALM Hub document $id URL.
 * Returns 'controls' for domain-scoped control documents, the resource type segment for
 * namespace-scoped documents ('architectures', 'patterns', 'standards', 'flows', 'interfaces'),
 * or undefined if the id does not follow a CALM Hub URL pattern.
 */
export function extractTypeSegmentFromDocumentId(docId: string): GitHubResourceDirectory | undefined {
    if (typeof docId !== 'string') {
        return undefined;
    }
    const resourceType = resourceTypeFromDocumentId(docId);
    if (resourceType) {
        return resourceType;
    }
    return isControlDocumentId(docId) ? 'controls' : undefined;
}

/**
 * Determine the expected CALM Hub GitHub directory for a document given its $id and manifest type.
 */
export function expectedDirectoryForDocument(
    docId?: string,
    manifestType?: string
): GitHubResourceDirectory | undefined {
    const typeSegment = docId ? extractTypeSegmentFromDocumentId(docId) : undefined;
    if (typeSegment) {
        return typeSegment;
    }
    if (manifestType && manifestType in DOCUMENT_TYPE_TO_DIRECTORY) {
        return DOCUMENT_TYPE_TO_DIRECTORY[manifestType];
    }
    return undefined;
}

/**
 * Inspect tracked documents in a workspace bundle and verify that each file's directory
 * path in the repository matches the layout required by CALM Hub GitHub storage mode.
 *
 * Follows the same classification rules as `CalmContentDetector` and emits a warning
 * when the directory determines the document type (rules 2 and 4) and does not match,
 * or when the file is in gitignored space or outside the project repository.
 */
export async function checkWorkspaceLayout(
    bundlePath: string,
    manifest?: WorkspaceManifest
): Promise<WorkspaceLayoutWarning[]> {
    const resolvedManifest = manifest ?? (await loadManifest(bundlePath));
    const projectRoot = findProjectRoot(bundlePath);

    const results = await Promise.all(
        Object.entries(resolvedManifest).map(async ([id, entry]): Promise<WorkspaceLayoutWarning | undefined> => {
            if (isNarrativeWorkspaceManifestEntry(entry)) {
                return undefined;
            }

            const absPath = resolveFilePath(bundlePath, entry.path);
            let raw: string;
            try {
                raw = await readFile(absPath, 'utf8');
            } catch {
                return undefined;
            }

            let docId = id;
            let parsedJson: Record<string, unknown> | undefined;
            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    parsedJson = parsed as Record<string, unknown>;
                    if (typeof parsedJson['$id'] === 'string' && parsedJson['$id'].trim()) {
                        docId = parsedJson['$id'].trim();
                    }
                }
            } catch {
                // Ignore parse errors here; validation handles syntax errors
            }

            const typeSegment = extractTypeSegmentFromDocumentId(docId);
            const expectedDir = expectedDirectoryForDocument(docId, entry.type);
            if (!expectedDir) {
                return undefined;
            }

            const rel = path.relative(projectRoot, absPath);
            if (path.isAbsolute(rel) || rel === '..' || rel.startsWith('..' + path.sep)) {
                return {
                    id,
                    filePath: absPath,
                    expectedDirectory: expectedDir,
                    typeSegment,
                    message: `Tracked file '${absPath}' is outside the repository. CALM Hub GitHub mode will not find it.`,
                };
            }

            const relToProject = rel.split(path.sep).join('/');

            if (relToProject.split('/').includes('.calm-workspace')) {
                return {
                    id,
                    filePath: relToProject,
                    expectedDirectory: expectedDir,
                    typeSegment,
                    message: `Tracked file '${relToProject}' is inside '.calm-workspace/' which is ignored by git. CALM Hub GitHub mode will not find it.`,
                };
            }

            const detected = detectDirectorySegment(relToProject);
            const classification = classifyGitHubDocument(parsedJson, detected);

            if (classification.source === 'content' || classification.directory === expectedDir) {
                return undefined;
            }

            const typeLabel = typeSegment ? `$id type '${typeSegment}'` : `type '${entry.type}'`;
            const outcome = classification.directory
                ? `CALM Hub GitHub mode will read it as ${DIRECTORY_TYPE_WITH_ARTICLE[classification.directory]}.`
                : 'CALM Hub GitHub mode will not import the file.';

            if (detected && isKnownGitHubDirectory(detected)) {
                return {
                    id,
                    filePath: relToProject,
                    expectedDirectory: expectedDir,
                    actualDirectory: detected,
                    typeSegment,
                    message: `Tracked file '${relToProject}' has ${typeLabel} but is in '${detected}/'; expected directory '${expectedDir}/'. ${outcome}`,
                };
            }

            const article = /^[aeiou]/i.test(expectedDir) ? 'an' : 'a';
            return {
                id,
                filePath: relToProject,
                expectedDirectory: expectedDir,
                actualDirectory: detected,
                typeSegment,
                message: `Tracked file '${relToProject}' has ${typeLabel} but is not in ${article} '${expectedDir}/' directory. ${outcome}`,
            };
        })
    );

    return results.filter((w): w is WorkspaceLayoutWarning => w !== undefined);
}

