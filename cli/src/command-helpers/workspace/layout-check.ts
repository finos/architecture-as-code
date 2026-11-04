import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import {
    canonicalGitHubDirectory,
    detectDirectorySegment,
    isKnownGitHubDirectory,
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

export interface WorkspaceLayoutWarning {
    id: string;
    filePath: string;
    expectedDirectory: string;
    actualDirectory?: string;
    typeSegment?: string;
    message: string;
}

/**
 * Extract the type segment from a CALM Hub document $id URL.
 * Returns 'controls' for domain-scoped control documents, the type segment for
 * namespace-scoped documents (e.g. 'architectures', 'patterns', 'standards',
 * 'flows', 'interfaces', 'timelines', 'adrs', 'decorators'), or undefined if the
 * id does not follow a CALM Hub URL pattern.
 */
export function extractTypeSegmentFromDocumentId(docId: string): string | undefined {
    if (typeof docId !== 'string') {
        return undefined;
    }
    const nsMatch = /\/calm\/namespaces\/[^/]+\/([^/]+)/.exec(docId);
    if (nsMatch) {
        return nsMatch[1].toLowerCase();
    }
    if (/\/calm\/domains\/[^/]+\/controls\//.test(docId)) {
        return 'controls';
    }
    return undefined;
}

/**
 * Determine the expected CALM Hub GitHub directory for a document given its $id and manifest type.
 */
export function expectedDirectoryForDocument(
    docId?: string,
    manifestType?: string
): GitHubResourceDirectory | undefined {
    if (docId) {
        const typeSegment = extractTypeSegmentFromDocumentId(docId);
        if (typeSegment) {
            const canonical = canonicalGitHubDirectory(typeSegment);
            if (canonical) {
                return canonical;
            }
        }
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
 * Emits a warning for each file placed in an unexpected directory, in gitignored space,
 * or outside the project repository.
 */
export async function checkWorkspaceLayout(
    bundlePath: string,
    manifest?: WorkspaceManifest
): Promise<WorkspaceLayoutWarning[]> {
    const resolvedManifest = manifest ?? (await loadManifest(bundlePath));
    const projectRoot = findProjectRoot(bundlePath);
    const warnings: WorkspaceLayoutWarning[] = [];

    for (const [id, entry] of Object.entries(resolvedManifest)) {
        if (isNarrativeWorkspaceManifestEntry(entry) || entry.type === 'sad' || entry.type === 'knowledge') {
            continue;
        }

        const absPath = resolveFilePath(bundlePath, entry.path);
        if (!existsSync(absPath)) {
            continue;
        }

        let docId = id;
        try {
            const raw = await readFile(absPath, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed['$id'] === 'string' && parsed['$id'].trim()) {
                docId = parsed['$id'].trim();
            }
        } catch {
            // Ignore parse errors here; validation handles syntax errors
        }

        const typeSegment = extractTypeSegmentFromDocumentId(docId);
        const expectedDir = expectedDirectoryForDocument(docId, entry.type);
        if (!expectedDir) {
            continue;
        }

        const relToProject = path.relative(projectRoot, absPath).split(path.sep).join('/');

        if (relToProject.startsWith('..')) {
            warnings.push({
                id,
                filePath: absPath,
                expectedDirectory: expectedDir,
                typeSegment,
                message: `Tracked file '${absPath}' is outside the repository. CALM Hub GitHub mode will not find it.`,
            });
            continue;
        }

        if (relToProject.split('/').includes('.calm-workspace')) {
            warnings.push({
                id,
                filePath: relToProject,
                expectedDirectory: expectedDir,
                typeSegment,
                message: `Tracked file '${relToProject}' is inside '.calm-workspace/' which is ignored by git. CALM Hub GitHub mode will not find it.`,
            });
            continue;
        }

        const detected = detectDirectorySegment(relToProject);
        const actualDir = detected ? canonicalGitHubDirectory(detected) : undefined;

        if (actualDir === expectedDir) {
            continue;
        }

        const typeLabel = typeSegment ? `$id type '${typeSegment}'` : `type '${entry.type}'`;

        if (detected && isKnownGitHubDirectory(detected)) {
            warnings.push({
                id,
                filePath: relToProject,
                expectedDirectory: expectedDir,
                actualDirectory: detected,
                typeSegment,
                message: `Tracked file '${relToProject}' has ${typeLabel} but is in '${detected}/'; expected directory '${expectedDir}/'. CALM Hub GitHub mode will read it as a ${actualDir}.`,
            });
        } else {
            warnings.push({
                id,
                filePath: relToProject,
                expectedDirectory: expectedDir,
                actualDirectory: detected,
                typeSegment,
                message: `Tracked file '${relToProject}' has ${typeLabel} but is not in an '${expectedDir}/' directory. CALM Hub GitHub mode will not read it as its type.`,
            });
        }
    }

    return warnings;
}
