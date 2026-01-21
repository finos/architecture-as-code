import { describe, it, afterEach } from 'vitest';
import { Docifier } from './docifier.js';
import { rmSync } from 'fs';
import { join } from 'path';
import { expectDirectoryMatch } from '../test/file-comparison';

const INPUT_DIR = join(
    __dirname,
    '../../test_fixtures/command/generate/expected-output'
);

const OUTPUT_DIR = join(
    __dirname,
    '../../test_fixtures/docify/workshop/actual-output'
);
const EXPECTED_OUTPUT_DIR = join(
    __dirname,
    '../../test_fixtures/docify/workshop/expected-output'
);

const URL_MAPPING_SECURE = join(
    __dirname,
    '../../test_fixtures/docify/workshop/url-mapping-secure.json'
);

const NON_SECURE_VERSION_DOC_WEBSITE = join(OUTPUT_DIR, 'non-secure');
const SECURE_VERSION_DOC_WEBSITE = join(OUTPUT_DIR, 'secure');

describe('Docifier E2E - Real Model and Template', () => {
    afterEach(() => {
        rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it('generates documentation from the conference-signup.arch.json model', async () => {
        const docifier = new Docifier(
            'WEBSITE',
            join(INPUT_DIR, 'conference-signup.arch.json'),
            NON_SECURE_VERSION_DOC_WEBSITE
        );
        await docifier.docify();
        await expectDirectoryMatch(
            join(EXPECTED_OUTPUT_DIR, 'non-secure'),
            join(OUTPUT_DIR, 'non-secure')
        );
    });

    it('generates documentation from the conference-secure-signup.arch.json model with explicit local mapping', async () => {
        const docifier = new Docifier(
            'WEBSITE',
            join(INPUT_DIR, 'conference-secure-signup-amended.arch.json'),
            SECURE_VERSION_DOC_WEBSITE,
            URL_MAPPING_SECURE
        );

        await docifier.docify();
        await expectDirectoryMatch(
            join(EXPECTED_OUTPUT_DIR, 'secure'),
            join(OUTPUT_DIR, 'secure')
        );
    });

    it('generates documentation from the conference-secure-signup.arch.json model with partial mapping', async () => {
        const docifier = new Docifier(
            'WEBSITE',
            join(INPUT_DIR, 'conference-secure-signup-amended.arch.json'),
            SECURE_VERSION_DOC_WEBSITE,
            URL_MAPPING_SECURE
        );
        await docifier.docify();
        await expectDirectoryMatch(
            join(EXPECTED_OUTPUT_DIR, 'secure'),
            join(OUTPUT_DIR, 'secure')
        );
    });
});
