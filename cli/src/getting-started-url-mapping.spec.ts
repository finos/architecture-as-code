import path from 'path';
import fs from 'node:fs';
import { describe, test, expect } from 'vitest';
import {
    STATIC_GETTING_STARTED_MAPPING_PATH,
    collectGettingStartedUrlsFromFile,
    isOptionalGettingStartedUrl,
    loadGettingStartedMapping,
    resolveLocalPathForUrl,
} from './test_helpers/getting-started-url-mapping';

const FILES_WITH_GETTING_STARTED_URLS = [
    path.resolve(
        __dirname,
        '../test_fixtures/getting-started/STEP-1/conference-signup.arch.json'
    ),
    path.resolve(
        __dirname,
        '../test_fixtures/getting-started/STEP-3/conference-signup-with-flow.arch.json'
    ),
    path.resolve(
        __dirname,
        '../../calm/getting-started/conference-signup.pattern.json'
    ),
];

// Ensures the static mapping the CLI now relies on stays aligned with the
// Getting Started fixtures and that every mapped URL has a local file present.
describe('Getting Started URL mapping', () => {
    test('static mapping covers all referenced URLs and files exist', () => {
        const mapping = loadGettingStartedMapping();
        const urls = new Set<string>();
        FILES_WITH_GETTING_STARTED_URLS.forEach((filePath) =>
            collectGettingStartedUrlsFromFile(filePath, urls)
        );

        urls.forEach((url) => {
            if (isOptionalGettingStartedUrl(url)) {
                return;
            }
            expect(mapping[url]).toBeDefined();
            const localPath = resolveLocalPathForUrl(
                url,
                mapping,
                STATIC_GETTING_STARTED_MAPPING_PATH
            );
            expect(localPath, `Mapping missing local path for ${url}`).toBeDefined();
            expect(
                fs.existsSync(localPath!),
                `Local file ${localPath} for ${url} does not exist`
            ).toBe(true);
        });
    });
});
