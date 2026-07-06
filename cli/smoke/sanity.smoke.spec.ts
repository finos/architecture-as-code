import path from 'path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { installPackedCli, type CliInstall } from '../src/test_helpers/cli-runner';

const CLI_ROOT = path.resolve(__dirname, '..');

describe('smoke scaffolding', () => {
    let cli: CliInstall;

    beforeAll(() => {
        cli = installPackedCli(CLI_ROOT, 'calm-smoke-sanity');
    }, 120_000);

    afterAll(() => cli?.cleanup());

    test('packed calm CLI reports a semver version', async () => {
        const { stdout } = await cli.run(['--version']);
        expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
});
