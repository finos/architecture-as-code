#!/usr/bin/env node
// Guards the browser entry point: bundles src/browser.ts for the browser, fails on any Node
// builtin request outside the documented allowlist, then executes a probe with those builtins
// stubbed to throw if touched. Run as part of `npm test` (see package.json).
import * as esbuild from 'esbuild';
import { builtinModules } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sharedRoot = path.resolve(here, '..');
const repoRoot = path.resolve(sharedRoot, '..');
const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

// Every Node builtin the browser bundle is allowed to *request* (none may be *touched* at
// runtime on the validate path — the probe proves that). Each entry: builtin + a regex on the
// importer path. Anything else fails the build. Extend only with a matching probe change.
const ALLOWED = [
    { builtin: 'fs', importer: /@stoplight\/spectral-runtime\/dist\/reader\.js$/ },
    { builtin: 'fs', importer: /@stoplight\/json-ref-readers\/file\.js$/ },
    { builtin: 'path', importer: /minimatch\/minimatch\.js$/ },
    { builtin: 'buffer', importer: /@stoplight\/yaml-ast-parser\/dist\/src\/type\/binary\.js$/ },
];

function stubPlugin(requests) {
    return {
        name: 'browser-entry-guard',
        setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
                if (!builtins.has(args.path)) return null;
                const builtin = args.path.replace(/^node:/, '');
                requests.push({ builtin, importer: args.importer });
                return { path: builtin, namespace: 'guard-stub' };
            });
            build.onLoad({ filter: /.*/, namespace: 'guard-stub' }, (args) => ({
                loader: 'js',
                contents: args.path === 'buffer'
                    ? 'export const Buffer = undefined; export default { Buffer };'
                    : `const stub = new Proxy({}, { get(_, key) {
                          if (key === '__esModule' || key === 'default' || key === 'then') return undefined;
                          throw new Error('browser entry touched Node builtin ${args.path}.' + String(key) + ' at runtime');
                       } });
                       export default stub;`,
            }));
        },
    };
}

async function bundle(entry, outfile, requests) {
    await esbuild.build({
        entryPoints: [entry],
        outfile,
        bundle: true,
        platform: 'browser',
        format: 'esm',
        mainFields: ['browser', 'module', 'main'],
        define: {
            'process.env.NODE_ENV': '"production"',
            process: 'undefined',
            Buffer: 'undefined',
        },
        logLevel: 'silent',
        plugins: [stubPlugin(requests)],
    });
}

function checkRequests(requests) {
    const problems = [];
    for (const { builtin, importer } of requests) {
        const rel = path.relative(repoRoot, importer);
        if (importer.startsWith(path.join(sharedRoot, 'src') + path.sep)) {
            problems.push(`shared source imports Node builtin '${builtin}': ${rel}`);
            continue;
        }
        if (!ALLOWED.some((a) => a.builtin === builtin && a.importer.test(importer))) {
            problems.push(`unexpected Node builtin '${builtin}' requested by ${rel}`);
        }
    }
    return problems;
}

async function main() {
    const workDir = await mkdtemp(path.join(tmpdir(), 'calm-browser-guard-'));
    try {
        const entryRequests = [];
        await bundle(path.join(sharedRoot, 'src/browser.ts'), path.join(workDir, 'browser.js'), entryRequests);
        const problems = checkRequests(entryRequests);
        if (problems.length) {
            console.error('Browser entry guard FAILED:\n  ' + problems.join('\n  '));
            process.exitCode = 1;
            return;
        }
        console.log(`browser entry: ${entryRequests.length} allowlisted builtin request(s), none from shared/src`);

        const probeOut = path.join(workDir, 'probe.js');
        // The probe's module graph is the entry's graph plus JSON schema fixtures, already
        // checked above, so its builtin requests are intentionally not re-checked here.
        await bundle(path.join(here, 'browser-probe.ts'), probeOut, []);
        await import(pathToFileURL(probeOut).href);
    } catch (err) {
        console.error('Browser entry guard FAILED: ' + (err instanceof Error ? err.message : String(err)));
        process.exitCode = 1;
    } finally {
        await rm(workDir, { recursive: true, force: true });
    }
}

await main();
