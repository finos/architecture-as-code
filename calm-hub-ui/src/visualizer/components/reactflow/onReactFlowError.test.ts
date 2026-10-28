import { afterEach, describe, expect, it, vi } from 'vitest';
import { onReactFlowError } from './onReactFlowError.js';

describe('onReactFlowError', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('ignores error 002 about new nodeTypes or edgeTypes objects', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        onReactFlowError('002', 'It looks like you have created a new nodeTypes object.');

        expect(warn).not.toHaveBeenCalled();
    });

    it('still logs any other React Flow error', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        onReactFlowError('001', 'Node type not found.');

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
            '[React Flow]: Node type not found. Help: https://reactflow.dev/error#001'
        );
    });
});