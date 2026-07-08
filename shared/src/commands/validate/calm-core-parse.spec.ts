import { describe, it, expect, vi } from 'vitest';
import { tryParseCalmCore } from './calm-core-parse';
import { Logger } from '../../logger';

function fakeLogger(): Logger {
    return {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    } as unknown as Logger;
}

describe('tryParseCalmCore', () => {
    it('parses a valid architecture into a CalmCore', () => {
        const logger = fakeLogger();
        const arch = { nodes: [{ 'unique-id': 'n1', 'node-type': 'service', name: 'N', description: 'D' }], relationships: [] };
        const core = tryParseCalmCore(arch, logger);
        expect(core).toBeDefined();
        expect(core!.nodes).toHaveLength(1);
        expect(logger.debug).not.toHaveBeenCalled();
    });

    it('returns undefined and logs at debug when the architecture cannot be parsed', () => {
        const logger = fakeLogger();
        const core = tryParseCalmCore(null as unknown as object, logger);
        expect(core).toBeUndefined();
        expect(logger.debug).toHaveBeenCalledOnce();
    });
});
