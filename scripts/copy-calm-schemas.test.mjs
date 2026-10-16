import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { copyCalmSchemas, ROOT_PACKAGE_JSON, schemaPackageJsonPaths } from './copy-calm-schemas.mjs';

const SCRIPT = fileURLToPath(new URL('./copy-calm-schemas.mjs', import.meta.url));

let root;
let dest;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'copy-calm-schemas-'));
    dest = join(root, 'dist', 'calm');
});

afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

function schema(release, file, extra = {}) {
    return JSON.stringify({ $id: `https://calm.finos.org/release/${release}/meta/${file}`, ...extra }, null, 4) + '\n';
}

function fakePackage(dirName, version, files = {}) {
    const packageDir = join(root, 'node_modules', dirName);
    mkdirSync(join(packageDir, 'schema'), { recursive: true });
    writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ name: '@finos/calm-schema', version }));
    for (const [file, content] of Object.entries(files)) {
        writeFileSync(join(packageDir, 'schema', file), content);
    }
    return join(packageDir, 'package.json');
}

function rootPackageJson(contents) {
    const path = join(root, 'package.json');
    writeFileSync(path, JSON.stringify(contents));
    return path;
}

describe('schemaPackageJsonPaths', () => {
    it('returns the root node_modules path of the latest slot and every alias', () => {
        const latest = fakePackage('@finos/calm-schema', '1.2.0');
        const alias10 = fakePackage('calm-schema-1.0', '1.0.0');
        const alias12 = fakePackage('calm-schema-1.2', '1.2.0');
        const path = rootPackageJson({
            dependencies: { 'calm-schema-0.9': 'npm:@finos/calm-schema@0.9.0' },
            devDependencies: {
                '@finos/calm-schema': '1.2.0',
                'calm-schema-1.0': 'npm:@finos/calm-schema@1.0.0',
                'calm-schema-1.2': 'npm:@finos/calm-schema@1.2.0',
                'calm-schema-extra': 'npm:@finos/calm-schema-extra@1.0.0',
                typescript: '^5.9.2',
            },
        });

        assert.deepEqual(schemaPackageJsonPaths(path), [latest, alias10, alias12]);
    });

    it('fails when no @finos/calm-schema devDependencies are found', () => {
        const path = rootPackageJson({ devDependencies: { typescript: '^5.9.2' } });

        assert.throws(() => schemaPackageJsonPaths(path), /package\.json: no @finos\/calm-schema devDependencies found/);
    });

    it('fails when there are no devDependencies', () => {
        const path = rootPackageJson({});

        assert.throws(() => schemaPackageJsonPaths(path), /no @finos\/calm-schema devDependencies found/);
    });

    it('fails when a package is not installed', () => {
        const path = rootPackageJson({ devDependencies: { 'calm-schema-1.0': 'npm:@finos/calm-schema@1.0.0' } });

        assert.throws(
            () => schemaPackageJsonPaths(path),
            /node_modules\/calm-schema-1\.0\/package\.json not found\. Run npm ci at the repository root\./,
        );
    });

    it('fails when the latest version has no alias', () => {
        fakePackage('@finos/calm-schema', '1.3.0');
        fakePackage('calm-schema-1.2', '1.2.0');
        const path = rootPackageJson({
            devDependencies: {
                '@finos/calm-schema': '1.3.0',
                'calm-schema-1.2': 'npm:@finos/calm-schema@1.2.0',
            },
        });

        assert.throws(
            () => schemaPackageJsonPaths(path),
            {
                message: '@finos/calm-schema is 1.3.0 but root package.json has no "calm-schema-1.3" alias. ' +
                    'Set "calm-schema-1.3": "npm:@finos/calm-schema@1.3.0" so 1.3 stays bundled when the latest release moves on.',
            },
        );
    });

    it('fails when the alias of the latest version points at another version', () => {
        fakePackage('@finos/calm-schema', '1.3.1');
        fakePackage('calm-schema-1.3', '1.3.0');
        const path = rootPackageJson({
            devDependencies: {
                '@finos/calm-schema': '1.3.1',
                'calm-schema-1.3': 'npm:@finos/calm-schema@1.3.0',
            },
        });

        assert.throws(
            () => schemaPackageJsonPaths(path),
            /has "calm-schema-1\.3": "npm:@finos\/calm-schema@1\.3\.0"\. Set "calm-schema-1\.3": "npm:@finos\/calm-schema@1\.3\.1"/,
        );
    });

    it('fails when an alias name does not match the version it pins', () => {
        fakePackage('calm-schema-1.1', '1.2.0');
        const path = rootPackageJson({ devDependencies: { 'calm-schema-1.1': 'npm:@finos/calm-schema@1.2.0' } });

        assert.throws(
            () => schemaPackageJsonPaths(path),
            { message: 'calm-schema-1.1 installs @finos/calm-schema 1.2.0. Name each alias calm-schema-<major.minor> after the version it pins.' },
        );
    });

    it('fails when an alias does not follow the calm-schema-<major.minor> name', () => {
        fakePackage('calm-schema-old', '1.0.0');
        const path = rootPackageJson({ devDependencies: { 'calm-schema-old': 'npm:@finos/calm-schema@1.0.0' } });

        assert.throws(() => schemaPackageJsonPaths(path), /calm-schema-old installs @finos\/calm-schema 1\.0\.0\./);
    });

    it('fails with the file name when the root package.json is not valid JSON', () => {
        const path = join(root, 'package.json');
        writeFileSync(path, '{ not json');

        assert.throws(() => schemaPackageJsonPaths(path), /package\.json: invalid JSON/);
    });
});

describe('copyCalmSchemas', () => {
    it('copies each package into release/<major.minor>/meta with the same bytes', () => {
        const core10 = schema('1.0', 'core.json', { title: 'core 1.0' });
        const calm12 = schema('1.2', 'calm.json');
        const core12 = schema('1.2', 'core.json', { title: 'core 1.2' });

        const copied = copyCalmSchemas(dest, [
            fakePackage('calm-schema-1.0', '1.0.0', { 'core.json': core10 }),
            fakePackage('@finos/calm-schema', '1.2.3', { 'calm.json': calm12, 'core.json': core12 }),
        ]);

        assert.equal(copied.length, 3);
        assert.deepEqual(readdirSync(join(dest, 'release')).sort(), ['1.0', '1.2']);
        assert.equal(readFileSync(join(dest, 'release/1.0/meta/core.json'), 'utf8'), core10);
        assert.equal(readFileSync(join(dest, 'release/1.2/meta/calm.json'), 'utf8'), calm12);
        assert.equal(readFileSync(join(dest, 'release/1.2/meta/core.json'), 'utf8'), core12);
    });

    it('accepts the same release from two packages when the content is identical', () => {
        const core = schema('1.2', 'core.json');

        const copied = copyCalmSchemas(dest, [
            fakePackage('calm-schema-1.2', '1.2.0', { 'core.json': core }),
            fakePackage('@finos/calm-schema', '1.2.0', { 'core.json': core }),
        ]);

        assert.equal(copied.length, 1);
        assert.equal(readFileSync(join(dest, 'release/1.2/meta/core.json'), 'utf8'), core);
    });

    it('fails when a schema $id does not match its release folder', () => {
        const packageJson = fakePackage('@finos/calm-schema', '1.3.0', { 'core.json': schema('1.2', 'core.json') });

        assert.throws(
            () => copyCalmSchemas(dest, [packageJson]),
            /core\.json: \$id is "https:\/\/calm\.finos\.org\/release\/1\.2\/meta\/core\.json", expected "https:\/\/calm\.finos\.org\/release\/1\.3\/meta\/core\.json"/,
        );
    });

    it('fails when a schema $id does not match its file name', () => {
        const packageJson = fakePackage('@finos/calm-schema', '1.2.0', { 'core.json': schema('1.2', 'calm.json') });

        assert.throws(() => copyCalmSchemas(dest, [packageJson]), /core\.json: \$id is .*calm\.json"/);
    });

    it('fails when two packages write different content to the same file', () => {
        const first = fakePackage('calm-schema-1.2', '1.2.0', { 'core.json': schema('1.2', 'core.json') });
        const second = fakePackage('@finos/calm-schema', '1.2.0', {
            'core.json': schema('1.2', 'core.json', { title: 'republished' }),
        });

        assert.throws(() => copyCalmSchemas(dest, [first, second]), /release\/1\.2\/meta\/core\.json: .* have different content/);
        assert.doesNotMatch(readFileSync(join(dest, 'release/1.2/meta/core.json'), 'utf8'), /republished/);
    });

    it('fails when the package version is not <major>.<minor>.<patch>', () => {
        const packageJson = fakePackage('@finos/calm-schema', '1.3.0-rc.1', { 'core.json': schema('1.3', 'core.json') });

        assert.throws(() => copyCalmSchemas(dest, [packageJson]), /version "1\.3\.0-rc\.1" is not <major>\.<minor>\.<patch>/);
    });

    it('fails when a package has no schema files', () => {
        const packageJson = fakePackage('@finos/calm-schema', '1.2.0');

        assert.throws(() => copyCalmSchemas(dest, [packageJson]), /no schema files found/);
    });

    it('fails with the full path when schema/ contains a folder', () => {
        const packageJson = fakePackage('@finos/calm-schema', '1.2.0', { 'core.json': schema('1.2', 'core.json') });
        mkdirSync(join(root, 'node_modules/@finos/calm-schema/schema/nested'));

        assert.throws(
            () => copyCalmSchemas(dest, [packageJson]),
            { message: `${join(root, 'node_modules/@finos/calm-schema/schema/nested')}: not a .json file` },
        );
    });

    it('fails with the full path when schema/ contains a file that is not .json', () => {
        const packageJson = fakePackage('@finos/calm-schema', '1.2.0', { 'README.md': '# schemas' });

        assert.throws(() => copyCalmSchemas(dest, [packageJson]), /schema\/README\.md: not a \.json file/);
    });

    it('fails with the file name when a schema is not valid JSON', () => {
        const packageJson = fakePackage('@finos/calm-schema', '1.2.0', { 'core.json': '{ "$id": ' });

        assert.throws(() => copyCalmSchemas(dest, [packageJson]), /schema\/core\.json: invalid JSON/);
    });
});

describe('copy-calm-schemas.mjs', () => {
    it('copies every pinned release from the installed packages', () => {
        // Derived, not hard-coded, so a Renovate bump of the latest slot still passes.
        const expectedReleases = [...new Set(schemaPackageJsonPaths(ROOT_PACKAGE_JSON).map(path => {
            const { version } = JSON.parse(readFileSync(path, 'utf8'));
            return version.split('.').slice(0, 2).join('.');
        }))].sort();

        const result = spawnSync(process.execPath, [SCRIPT, dest], { encoding: 'utf8' });

        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(readdirSync(join(dest, 'release')).sort(), expectedReleases);
        assert.ok(existsSync(join(dest, 'release/1.2/meta/calm.json')));
    });

    it('exits non-zero without a destination', () => {
        const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });

        assert.equal(result.status, 1);
        assert.match(result.stderr, /Usage: node scripts\/copy-calm-schemas\.mjs <dest>/);
    });

    it('runs when called through a symlink', () => {
        const link = join(root, 'copy-calm-schemas.mjs');
        symlinkSync(SCRIPT, link);

        const result = spawnSync(process.execPath, [link], { encoding: 'utf8' });

        assert.equal(result.status, 1);
        assert.match(result.stderr, /Usage: node scripts\/copy-calm-schemas\.mjs <dest>/);
    });
});
