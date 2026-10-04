#!/usr/bin/env node

/**
 * Copies the released CALM meta schemas from the @finos/calm-schema npm
 * packages into <dest>/release/<major.minor>/meta/, the layout that the CLI
 * and calm-server bundle in dist/calm.
 *
 * The packages are the root package.json devDependencies on @finos/calm-schema:
 * the latest version, plus one calm-schema-<major.minor> alias per released
 * version, so older versions stay in the bundles when @finos/calm-schema moves
 * to a new release. The latest version must have its alias too.
 *
 * Usage: node scripts/copy-calm-schemas.mjs <dest>
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA_PACKAGE = '@finos/calm-schema';

export const ROOT_PACKAGE_JSON = fileURLToPath(new URL('../package.json', import.meta.url));

function parseJson(text, path) {
    try {
        return JSON.parse(text);
    } catch (err) {
        throw new Error(`${path}: invalid JSON (${err.message})`);
    }
}

function readJson(path) {
    return parseJson(readFileSync(path, 'utf8'), path);
}

function packageRelease(packageJsonPath) {
    const { version } = readJson(packageJsonPath);
    const match = /^(\d+)\.(\d+)\.\d+$/.exec(version);
    if (!match) {
        throw new Error(`${packageJsonPath}: version "${version}" is not <major>.<minor>.<patch>`);
    }
    return { version, release: `${match[1]}.${match[2]}` };
}

export function schemaPackageJsonPaths(rootPackageJsonPath) {
    const { devDependencies = {} } = readJson(rootPackageJsonPath);
    const names = Object.entries(devDependencies)
        .filter(([name, spec]) => name === SCHEMA_PACKAGE || spec.startsWith(`npm:${SCHEMA_PACKAGE}@`))
        .map(([name]) => name);
    if (names.length === 0) {
        throw new Error(`${rootPackageJsonPath}: no ${SCHEMA_PACKAGE} devDependencies found`);
    }

    // Root devDependencies always install into the root node_modules. A direct path, unlike
    // require.resolve, does not break if the package adds an "exports" map.
    const nodeModules = join(dirname(rootPackageJsonPath), 'node_modules');
    const paths = names.map(name => {
        const path = join(nodeModules, name, 'package.json');
        if (!existsSync(path)) {
            throw new Error(`${path} not found. Run npm ci at the repository root.`);
        }
        return path;
    });

    for (const [index, name] of names.entries()) {
        if (name === SCHEMA_PACKAGE) {
            continue;
        }
        const { version, release } = packageRelease(paths[index]);
        if (name !== `calm-schema-${release}`) {
            throw new Error(
                `${name} installs ${SCHEMA_PACKAGE} ${version}. ` +
                `Name each alias calm-schema-<major.minor> after the version it pins.`,
            );
        }
    }

    if (names.includes(SCHEMA_PACKAGE)) {
        const { version, release } = packageRelease(join(nodeModules, SCHEMA_PACKAGE, 'package.json'));
        const alias = `calm-schema-${release}`;
        const expected = `npm:${SCHEMA_PACKAGE}@${version}`;
        const actual = devDependencies[alias];
        if (actual !== expected) {
            const found = actual ? `"${alias}": "${actual}"` : `no "${alias}" alias`;
            throw new Error(
                `${SCHEMA_PACKAGE} is ${version} but root package.json has ${found}. ` +
                `Set "${alias}": "${expected}" so ${release} stays bundled when the latest release moves on.`,
            );
        }
    }

    return paths;
}

export function copyCalmSchemas(destDir, packageJsonPaths) {
    const written = new Map();

    for (const packageJsonPath of packageJsonPaths) {
        const { release } = packageRelease(packageJsonPath);
        const schemaDir = join(dirname(packageJsonPath), 'schema');
        const entries = readdirSync(schemaDir, { withFileTypes: true });
        if (entries.length === 0) {
            throw new Error(`${schemaDir}: no schema files found`);
        }

        const targetDir = join(destDir, 'release', release, 'meta');
        mkdirSync(targetDir, { recursive: true });

        for (const entry of entries) {
            const source = join(schemaDir, entry.name);
            if (!entry.isFile() || !entry.name.endsWith('.json')) {
                throw new Error(`${source}: not a .json file`);
            }

            // Copy the raw bytes; the JSON is parsed only to check $id.
            const content = readFileSync(source);
            const expectedId = `https://calm.finos.org/release/${release}/meta/${entry.name}`;
            const { $id } = parseJson(content, source);
            if ($id !== expectedId) {
                throw new Error(`${source}: $id is "${$id}", expected "${expectedId}"`);
            }

            const target = join(targetDir, entry.name);
            const previous = written.get(target);
            if (previous && !previous.content.equals(content)) {
                throw new Error(`${target}: ${previous.source} and ${source} have different content`);
            }
            writeFileSync(target, content);
            written.set(target, { source, content });
        }
    }

    return [...written.keys()];
}

// realpath because argv[1] keeps symlinks but import.meta.url does not.
const isMain = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    const destDir = process.argv[2];
    if (!destDir) {
        console.error('Usage: node scripts/copy-calm-schemas.mjs <dest>');
        process.exit(1);
    }

    try {
        const copied = copyCalmSchemas(destDir, schemaPackageJsonPaths(ROOT_PACKAGE_JSON));
        console.log(`Copied ${copied.length} CALM schema files to ${join(destDir, 'release')}`);
    } catch (err) {
        console.error(`Failed to copy CALM schemas: ${err.message}`);
        process.exit(1);
    }
}
