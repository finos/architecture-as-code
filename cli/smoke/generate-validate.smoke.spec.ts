import path from 'path';
import * as fs from 'fs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { installPackedCli, type CliInstall } from '../src/test_helpers/cli-runner';
import { SMOKE_HUB_URL } from './global-setup';
import { hubApi } from './harness/hub-api';
import { hubDocId, readJson } from './harness/fixtures';

const CLI_ROOT = path.resolve(__dirname, '..');
const NS = 'smoke-genval';
const PATTERN_FIXTURE = path.resolve(__dirname, 'fixtures/genval/conference-signup.pattern.json');
const PATTERN_URL = hubDocId(NS, 'patterns', 'conference-signup', '1.0.0');
const api = hubApi();

const CONTROLS_DIR = path.resolve(__dirname, 'fixtures/genval/controls');
const CONTROL_DOMAIN = 'smoke-online';
const REQUIREMENT = path.join(CONTROLS_DIR, 'security-control.requirement.json');
const GOOD_CONFIG = path.join(CONTROLS_DIR, 'security-control-good.config.json');
const BAD_CONFIG = path.join(CONTROLS_DIR, 'security-control-bad.config.json');
const SERVICE_DETAIL_ARCH = path.resolve(__dirname, 'fixtures/genval/service-detail.architecture.json');
const GOOD_CONTROL_ARCH = path.resolve(__dirname, 'fixtures/genval/good-control.architecture.json');
const BAD_CONTROL_ARCH = path.resolve(__dirname, 'fixtures/genval/bad-control.architecture.json');

interface ValidationOutput {
    code?: string;
    severity?: string;
    message?: string;
    path?: string;
}

interface ValidationResult {
    hasErrors: boolean;
    jsonSchemaValidationOutputs: ValidationOutput[];
    spectralSchemaValidationOutputs: ValidationOutput[];
}

describe('Flow 2: generate/validate (local + CalmHub refs)', () => {
    let cli: CliInstall;

    beforeAll(async () => {
        cli = installPackedCli(CLI_ROOT, 'calm-smoke-genval');
        await cli.run(['hub', 'create', 'namespace', '--name', NS, '--description', 'smoke genval', '-c', SMOKE_HUB_URL]);

        // Push from temp copies: `hub push` rewrites the document $id in place, which would
        // otherwise dirty the fixtures.
        //
        // NB: this assumes CalmHub's push endpoints store control documents as-is and do NOT
        // validate a configuration against its requirement on ingest. If that changes, pushing the
        // deliberately-bad config here would be rejected and the bad-config case below would need to
        // seed its fixtures another way (e.g. write directly to storage, or validate against a
        // locally-mapped requirement instead).
        await cli.run(['hub', 'create', 'domain', '--name', CONTROL_DOMAIN, '-c', SMOKE_HUB_URL]);
        const reqTmp = path.join(cli.tempDir, 'requirement.json');
        const goodTmp = path.join(cli.tempDir, 'good.config.json');
        const badTmp = path.join(cli.tempDir, 'bad.config.json');
        const serviceDetailTmp = path.join(cli.tempDir, 'service-detail.architecture.json');
        fs.copyFileSync(REQUIREMENT, reqTmp);
        fs.copyFileSync(GOOD_CONFIG, goodTmp);
        fs.copyFileSync(BAD_CONFIG, badTmp);
        fs.copyFileSync(SERVICE_DETAIL_ARCH, serviceDetailTmp);
        await cli.run(['hub', 'push', 'control-requirement', reqTmp, '-c', SMOKE_HUB_URL]);
        await cli.run(['hub', 'push', 'control-configuration', goodTmp, '-c', SMOKE_HUB_URL]);
        await cli.run(['hub', 'push', 'control-configuration', badTmp, '-c', SMOKE_HUB_URL]);
        await cli.run(['hub', 'push', 'architecture', serviceDetailTmp, '-c', SMOKE_HUB_URL]);
    }, 120_000);

    afterAll(() => cli?.cleanup());

    test('generate from a local pattern produces an architecture', async () => {
        const out = path.join(cli.tempDir, 'local-arch.json');
        await cli.run(['generate', '-p', PATTERN_FIXTURE, '-o', out]);
        expect(fs.existsSync(out)).toBe(true);
        const nodes = readJson(out).nodes as unknown[];
        expect(Array.isArray(nodes)).toBe(true);
        expect(nodes.length).toBeGreaterThan(0);
    });

    test('validate a local architecture against the local pattern passes', async () => {
        const arch = path.join(cli.tempDir, 'local-arch.json');
        expect(fs.existsSync(arch)).toBe(true);
        const { stdout } = await cli.run(['validate', '-p', PATTERN_FIXTURE, '-a', arch, '-f', 'json']);
        expect(JSON.parse(stdout).hasErrors).toBe(false);
    });

    test('the pattern can be pushed to and served from the hub', async () => {
        await cli.run(['hub', 'push', 'pattern', PATTERN_FIXTURE, '--name', 'conference-signup', '-c', SMOKE_HUB_URL]);
        expect(await api.listVersions(NS, 'patterns', 'conference-signup')).toContain('1.0.0');
    });

    test('generate from a CalmHub-hosted pattern URL produces an architecture', async () => {
        const out = path.join(cli.tempDir, 'hub-arch.json');
        await cli.run(['generate', '-p', PATTERN_URL, '-o', out, '-c', SMOKE_HUB_URL]);
        expect(fs.existsSync(out)).toBe(true);
        const nodes = readJson(out).nodes as unknown[];
        expect(Array.isArray(nodes)).toBe(true);
        expect(nodes.length).toBeGreaterThan(0);
    });

    // #2827 fixed: an http(s) control-schema ref on a different host to `-c` now falls through to
    // DirectUrlDocumentLoader (calm.finos.org is allowlisted by default) instead of being wrongly
    // claimed and fetched path-only against the wrong hub.
    test('validate with -c against a pattern referencing cross-host CalmHub control schemas resolves them via DirectUrlDocumentLoader (#2827)', async () => {
        const arch = path.join(cli.tempDir, 'hub-arch.json');
        expect(fs.existsSync(arch)).toBe(true);

        const { stdout } = await cli.run(['validate', '-p', PATTERN_URL, '-a', arch, '-f', 'json', '-c', SMOKE_HUB_URL]);

        const parsed = JSON.parse(stdout) as ValidationResult;
        expect(parsed.hasErrors).toBe(false);

        const controlErrors = parsed.jsonSchemaValidationOutputs.filter(
            o => o.code === 'control-requirement-validation'
        );
        expect(controlErrors).toEqual([]);
    });

    // Same-host counterpart to #2827 above: requirement/config hosted on the same host as -c, so
    // CalmHubDocumentLoader resolves them directly. Also exercises recursive descent into a
    // hub-hosted node-details detailed-architecture.
    test('a compliant control validated against its CalmHub-hosted requirement passes', async () => {
        const { stdout } = await cli.run(['validate', '-a', GOOD_CONTROL_ARCH, '-c', SMOKE_HUB_URL, '-f', 'json']);
        const result = JSON.parse(stdout) as ValidationResult;
        expect(result.hasErrors).toBe(false);
        const controlErrors = result.jsonSchemaValidationOutputs.filter(
            o => o.code === 'control-requirement-validation'
        );
        expect(controlErrors).toEqual([]);
    });

    test('a control whose config-id breaks its CalmHub-hosted requirement is reported', async () => {
        const result = await cli
            .run(['validate', '-a', BAD_CONTROL_ARCH, '-c', SMOKE_HUB_URL, '-f', 'json'])
            .catch(e => e);
        expect(result.exitCode).toBe(1);
        const parsed = JSON.parse(result.stdout) as ValidationResult;
        expect(parsed.hasErrors).toBe(true);
        const controlErrors = parsed.jsonSchemaValidationOutputs.filter(
            o => o.code === 'control-requirement-validation'
        );
        expect(controlErrors.length).toBeGreaterThan(0);
        expect(controlErrors[0].path).toContain('/control-id');
    });
});
