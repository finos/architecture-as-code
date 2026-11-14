import { describe, expect, it } from 'vitest';
import { isBlocksReply } from './reply.js';

describe('isBlocksReply', () => {
    it('accepts only a blocks reply of the extension API version', () => {
        expect(isBlocksReply({ hubApi: 0, blocks: [] }, 0)).toBe(true);
        expect(isBlocksReply({ hubApi: 1, blocks: [] }, 0)).toBe(false);
        expect(isBlocksReply({ hubApi: 0 }, 0)).toBe(false);
        expect(isBlocksReply(null, 0)).toBe(false);
    });
});
