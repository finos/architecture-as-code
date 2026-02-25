import fs from 'node:fs';
import path from 'path';

const GETTING_STARTED_URL_PREFIX = 'https://calm.finos.org/getting-started/';
const OPTIONAL_RELATIVE_PREFIXES = ['flows/'];

export const STATIC_GETTING_STARTED_MAPPING_PATH = path.resolve(
    __dirname,
    '../../test_fixtures/getting-started/url-to-local-file-mapping.json'
);

export function collectGettingStartedUrlsFromFile(
    filePath: string,
    urls: Set<string>
): void {
    let architecture;
    try {
        architecture = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        throw new Error(
            `Failed to read or parse JSON from file "${filePath}": ${err instanceof Error ? err.message : String(err)}`
        );
    }
    collectGettingStartedUrls(architecture, urls);
}

export function loadGettingStartedMapping(
    mappingPath: string = STATIC_GETTING_STARTED_MAPPING_PATH
): Record<string, string> {
    try {
        return JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    } catch (err) {
        throw new Error(
            `Failed to read or parse JSON from mapping file "${mappingPath}": ${err instanceof Error ? err.message : String(err)}`
        );
    }
}

export function resolveLocalPathForUrl(
    url: string,
    mapping: Record<string, string>,
    mappingPath: string = STATIC_GETTING_STARTED_MAPPING_PATH
): string | undefined {
    const relativePath = mapping[url];
    if (!relativePath) {
        return undefined;
    }
    const mappingDir = path.dirname(mappingPath);
    return path.resolve(mappingDir, relativePath);
}

export function isOptionalGettingStartedUrl(url: string): boolean {
    const relativePath = url.slice(GETTING_STARTED_URL_PREFIX.length);
    return OPTIONAL_RELATIVE_PREFIXES.some((prefix) =>
        relativePath.startsWith(prefix)
    );
}

function collectGettingStartedUrls(value: unknown, urls: Set<string>): void {
    if (value === null || value === undefined) {
        return;
    }

    if (typeof value === 'string') {
        if (value.startsWith(GETTING_STARTED_URL_PREFIX)) {
            urls.add(value);
        }
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item) => collectGettingStartedUrls(item, urls));
        return;
    }

    if (typeof value === 'object') {
        Object.values(value as Record<string, unknown>).forEach((v) =>
            collectGettingStartedUrls(v, urls)
        );
    }
}
