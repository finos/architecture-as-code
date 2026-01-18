import { describe, it, afterEach, beforeEach } from 'vitest';
import { Docifier } from './docifier.js';
import { rmSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { expectDirectoryMatch } from '../test/file-comparison';

/**
 * This test ensures that both generation modes produce identical output:
 *
 * Option A: Direct generation
 *   npx calm docify -a <arch> -u <url-mapping> -o <output>
 *
 * Option B: Scaffold + Template-dir (two-step process)
 *   npx calm docify -a <arch> -u <url-mapping> -o <scaffold-output> --scaffold
 *   npx calm docify -a <arch> -u <url-mapping> --template-dir <scaffold-output> -o <final-output>
 *
 * Both options should produce identical results.
 */

const CLI_FIXTURES_DIR = join(__dirname, '../../../cli/test_fixtures');
const GETTING_STARTED_DIR = join(CLI_FIXTURES_DIR, 'getting-started/STEP-3');

const ARCH_FILE = join(GETTING_STARTED_DIR, 'conference-signup-with-flow.arch.json');
const URL_MAPPING_FILE = join(CLI_FIXTURES_DIR, 'getting-started/url-to-local-file-mapping.json');

const SHARED_FIXTURES_DIR = join(__dirname, '../../test_fixtures');
const OUTPUT_DIR = join(SHARED_FIXTURES_DIR, 'docify/parity/actual-output');
const OPTION_A_OUTPUT = join(OUTPUT_DIR, 'option-a-direct');
const OPTION_B_SCAFFOLD = join(OUTPUT_DIR, 'option-b-scaffold');
const OPTION_B_FINAL = join(OUTPUT_DIR, 'option-b-final');

describe('Docifier Parity E2E - Option A vs Option B', () => {
    beforeEach(() => {
        // Clean up any existing output directories
        if (existsSync(OUTPUT_DIR)) {
            rmSync(OUTPUT_DIR, { recursive: true, force: true });
        }
        mkdirSync(OUTPUT_DIR, { recursive: true });
    });

    afterEach(() => {
        rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it('Option A (direct) and Option B (scaffold + template-dir) produce identical output', async () => {
        // Option A: Direct generation (single step)
        const docifierOptionA = new Docifier(
            'WEBSITE',
            ARCH_FILE,
            OPTION_A_OUTPUT,
            URL_MAPPING_FILE,
            'bundle',
            undefined,
            false,
            false
        );
        await docifierOptionA.docify();

        // Option B Step 1: Scaffold generation
        const docifierOptionB_Scaffold = new Docifier(
            'WEBSITE',
            ARCH_FILE,
            OPTION_B_SCAFFOLD,
            URL_MAPPING_FILE,
            'bundle',
            undefined,
            false,
            true
        );
        await docifierOptionB_Scaffold.docify();

        // Option B Step 2: Template-dir generation from scaffold
        const docifierOptionB_Final = new Docifier(
            'USER_PROVIDED',
            ARCH_FILE,
            OPTION_B_FINAL,
            URL_MAPPING_FILE,
            'template-directory',
            OPTION_B_SCAFFOLD,
            false,
            false
        );
        await docifierOptionB_Final.docify();

        // Compare Option A and Option B outputs - they should be identical
        await expectDirectoryMatch(OPTION_A_OUTPUT, OPTION_B_FINAL);
    });

    it('generates correct structure with nodes, relationships, flows, and config files', async () => {
        // Generate using Option A (direct)
        const docifier = new Docifier(
            'WEBSITE',
            ARCH_FILE,
            OPTION_A_OUTPUT,
            URL_MAPPING_FILE,
            'bundle',
            undefined,
            false,
            false
        );
        await docifier.docify();

        // Verify expected files exist
        const expectedFiles = [
            'docs/index.md',
            'docs/nodes/conference-website.md',
            'docs/nodes/load-balancer.md',
            'docs/nodes/attendees.md',
            'docs/nodes/attendees-store.md',
            'docs/nodes/k8s-cluster.md',
            'docs/relationships/conference-website-load-balancer.md',
            'docs/relationships/load-balancer-attendees.md',
            'docs/relationships/attendees-attendees-store.md',
            'docs/relationships/deployed-in-k8s-cluster.md',
            'docs/flows/flow-conference-signup.md',
            'sidebars.js',
            'docusaurus.config.js',
            'package.json',
            'static/img/2025_CALM_Icon.svg',
            'static/css/custom.css'
        ];

        for (const file of expectedFiles) {
            const filePath = join(OPTION_A_OUTPUT, file);
            expect(existsSync(filePath), `Expected file to exist: ${file}`).toBe(true);
        }
    });

    it('front-matter contains required fields for VSCode plugin compatibility', async () => {
        const { readFileSync } = await import('fs');

        // Generate using Option A (direct)
        const docifier = new Docifier(
            'WEBSITE',
            ARCH_FILE,
            OPTION_A_OUTPUT,
            URL_MAPPING_FILE,
            'bundle',
            undefined,
            false,
            false
        );
        await docifier.docify();

        // Check a node file has correct front-matter
        const nodeFile = readFileSync(join(OPTION_A_OUTPUT, 'docs/nodes/attendees.md'), 'utf8');
        expect(nodeFile).toContain('architecture:');
        expect(nodeFile).toContain('url-to-local-file-mapping:');
        expect(nodeFile).toContain('node-id: attendees');
        expect(nodeFile).toContain('id: "attendees"');
        expect(nodeFile).toContain('title:');

        // Check a relationship file has correct front-matter
        const relFile = readFileSync(join(OPTION_A_OUTPUT, 'docs/relationships/load-balancer-attendees.md'), 'utf8');
        expect(relFile).toContain('architecture:');
        expect(relFile).toContain('url-to-local-file-mapping:');
        expect(relFile).toContain('relationship-id: load-balancer-attendees');

        // Check a flow file has correct front-matter
        const flowFile = readFileSync(join(OPTION_A_OUTPUT, 'docs/flows/flow-conference-signup.md'), 'utf8');
        expect(flowFile).toContain('architecture:');
        expect(flowFile).toContain('url-to-local-file-mapping:');
        expect(flowFile).toContain('flow-id: flow-conference-signup');
    });
});

