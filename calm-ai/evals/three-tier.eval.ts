import { readFile } from 'node:fs/promises';
import { test } from 'vitest';
import { selectAssistant, runEval } from './runner';
import { assertThreeTier, filename, prompt } from './three-tier';

const assistant = selectAssistant();

test(`${assistant.provider} creates a valid three-tier CALM architecture`, async () => {
    await runEval(assistant, prompt, filename, async path => {
        assertThreeTier(JSON.parse(await readFile(path, 'utf8')));
    });
});
