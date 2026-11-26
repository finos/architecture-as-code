import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { Reporter, Vitest } from 'vitest/node';
import type {} from './evals/runner.js';

const sandbox = fileURLToPath(new URL('../sandbox/calm-ai-evals/', import.meta.url));
let vitest: Vitest;
let runDirectory: string | undefined;

const artifacts: Reporter = {
    onInit(context) {
        vitest = context;
    },
    async onTestRunStart(specifications) {
        if (specifications.length === 0) return;
        await mkdir(sandbox, { recursive: true });
        runDirectory = await mkdtemp(join(sandbox, 'run-'));
        vitest.provide('evalRunDirectory', runDirectory);
    },
    async onTestRunEnd(_modules, errors, reason) {
        if (!runDirectory) return;
        const directory = runDirectory;
        runDirectory = undefined;
        if (reason === 'passed' && errors.length === 0 && process.env.CALM_EVAL_KEEP_ARTIFACTS !== '1') {
            await rm(directory, { recursive: true, force: true });
        } else {
            console.log(`CALM eval artifacts: ${directory}`);
        }
    },
};

export default defineConfig({
    test: {
        include: ['evals/**/*.eval.ts'],
        testTimeout: 360_000,
        fileParallelism: false,
        reporters: ['default', artifacts],
    },
});
