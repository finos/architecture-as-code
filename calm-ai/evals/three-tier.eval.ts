import { readFile } from 'node:fs/promises';
import { test } from 'vitest';
import { codex, runEval } from './runner';
import { assertThreeTier, filename, prompt } from './three-tier';

test('Codex creates a valid three-tier CALM architecture', async () => {
    await runEval(codex, prompt, filename, async path => {
        assertThreeTier(JSON.parse(await readFile(path, 'utf8')));
    });
});
