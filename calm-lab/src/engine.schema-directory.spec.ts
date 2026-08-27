/**
 * The memoised SchemaDirectory is module state, so this lives apart from
 * engine.spec.ts: the mock below must not reach the real-engine tests.
 */
import { describe, it, expect, vi } from 'vitest';

const loads = vi.hoisted(() => ({ attempts: 0 }));

vi.mock('@finos/calm-shared/browser', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    const RealSchemaDirectory = actual.SchemaDirectory as new (...args: never[]) => { loadSchemas(): Promise<void> };
    return {
        ...actual,
        // Fails the first load only; everything else stays real so a retry
        // genuinely validates.
        SchemaDirectory: class extends RealSchemaDirectory {
            async loadSchemas(): Promise<void> {
                loads.attempts += 1;
                if (loads.attempts === 1) {
                    throw new Error('schema load failed');
                }
                await super.loadSchemas();
            }
        },
    };
});

const architecture = JSON.stringify({
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'a' }],
    relationships: [],
});

describe('schema directory memoisation', () => {
    it('does not memoise a failed schema load', async () => {
        vi.resetModules();
        const { validateArchitecture } = await import('./engine');

        await expect(validateArchitecture(architecture)).rejects.toThrow('schema load failed');

        const result = await validateArchitecture(architecture);
        expect(result.ok).toBe(true);
        expect(loads.attempts).toBe(2);
    });
});
