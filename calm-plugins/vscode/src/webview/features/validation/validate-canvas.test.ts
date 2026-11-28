import { afterEach, describe, expect, it } from 'vitest';
import { setLastParsedArch } from '../../transforms/calm-editor-transformer';
import { validateCanvas } from './validate-canvas';

afterEach(() => setLastParsedArch(null));

describe('validating documents without node and relationship keys', () => {
    it('validates an empty document without requiring a nodes array', () => {
        setLastParsedArch({});
        const result = validateCanvas({ nodes: [], edges: [], documentControls: {}, flows: [], standardNodes: [] });
        expect(result.nodes).toEqual([]);
        expect(result.issues).toContainEqual(expect.objectContaining({
            severity: 'info',
            message: expect.stringContaining('0 node(s)'),
        }));
    });
});
