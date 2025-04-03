import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Docifier } from './docifier.js';
import { mkdirSync, rmSync, existsSync} from 'fs';
import { join } from 'path';

const INPUT_DIR = join(
    __dirname,
    '../../test_fixtures/command/generate/expected-output'
);

const WORKSHOP_DIR = join(
    __dirname,
    '../../../calm/workshop/controls'
);

const OUTPUT_DIR = join(__dirname, '../../test_fixtures/docify/workshop/actual-output');
const NON_SECURE_VERSION_DOC_WEBSITE =  join(OUTPUT_DIR,'non-secure');
const SECURE_VERSION_DOC_WEBSITE =  join(OUTPUT_DIR,'secure');

describe('Docifier E2E - Real Model and Template', () => {
    beforeEach(() => {
        rmSync(OUTPUT_DIR, { recursive: true, force: true });
        mkdirSync(OUTPUT_DIR, { recursive: true });
    });

    afterEach(() => {
        rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it('generates documentation from the conference-signup.arch.json model', async () => {
        const mapping = new Map<string, string>();

        const docifier = new Docifier('WEBSITE', join(INPUT_DIR, 'conference-signup.arch.json'), NON_SECURE_VERSION_DOC_WEBSITE, mapping);
        await docifier.docify();

        //Verifying a few files
        const packageJsonPath = join(NON_SECURE_VERSION_DOC_WEBSITE, 'package.json');
        const indexMdPath = join(NON_SECURE_VERSION_DOC_WEBSITE, 'docs/index.md');

        expect(existsSync(NON_SECURE_VERSION_DOC_WEBSITE)).toBe(true);
        expect(existsSync(packageJsonPath)).toBe(true);
        expect(existsSync(indexMdPath)).toBe(true);

    });

    it('generates documentation from the conference-secure-signup.arch.json model', async () => {
        const mapping = new Map<string, string>([
            ['https://calm.finos.org/workshop/controls/micro-segmentation.config.json', join(WORKSHOP_DIR, 'micro-segmentation.config.json')],
            ['https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json', join(WORKSHOP_DIR, 'micro-segmentation.requirement.json')],
            ['https://calm.finos.org/workshop/controls/permitted-connection.requirement.json', join(WORKSHOP_DIR, 'permitted-connection.requirement.json')],
        ]);


        const docifier = new Docifier('WEBSITE', join(INPUT_DIR, 'conference-signup.arch.json'), SECURE_VERSION_DOC_WEBSITE, mapping);

        await docifier.docify();

        //Verifying a few files
        const packageJsonPath = join(SECURE_VERSION_DOC_WEBSITE, 'package.json');
        const indexMdPath = join(SECURE_VERSION_DOC_WEBSITE, 'docs/index.md');

        expect(existsSync(SECURE_VERSION_DOC_WEBSITE)).toBe(true);
        expect(existsSync(packageJsonPath)).toBe(true);
        expect(existsSync(indexMdPath)).toBe(true);

    });
});
