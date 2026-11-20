import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolveFilePath, type WorkspaceManifest } from './bundle';
import { isNarrativeWorkspaceManifestEntry } from './document-kind';
import { extractDocumentMetadata, hasExpectedBaseUrl, type DocumentMetadata } from '@finos/calm-shared';

export interface BaseUrlMismatch {
    id: string;
    actual: string;
}

export function baseUrlMismatchMessage(id: string, actual: string, expected: string): string {
    return `'${id}' $id base URL '${actual}' does not match CalmHub base URL '${expected}'. ` +
        'Update the $id, or pass --base-url if CalmHub is configured with a different calm.hub.base-url.';
}

/** Mapping documents whose `$id` base URL CalmHub would reject; unparseable `$id`s are left to other checks. */
export async function findBaseUrlMismatches(
    bundlePath: string,
    manifest: WorkspaceManifest,
    expectedBaseUrl: string
): Promise<BaseUrlMismatch[]> {
    const mismatches: BaseUrlMismatch[] = [];
    for (const [id, entry] of Object.entries(manifest)) {
        if (isNarrativeWorkspaceManifestEntry(entry)) continue;
        const filePath = resolveFilePath(bundlePath, entry.path);
        if (!existsSync(filePath)) continue;
        let metadata: DocumentMetadata;
        try {
            metadata = extractDocumentMetadata(await readFile(filePath, 'utf8'));
        } catch {
            continue;
        }
        if (!hasExpectedBaseUrl(metadata, expectedBaseUrl)) {
            mismatches.push({ id, actual: metadata.baseUrl });
        }
    }
    return mismatches;
}
