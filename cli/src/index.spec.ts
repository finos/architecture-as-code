import { afterEach, describe, expect, it, vi } from 'vitest';

const parseAsync = vi.hoisted(() => vi.fn());
const setupCLI = vi.hoisted(() => vi.fn());

vi.mock('commander', () => ({
    program: { parseAsync },
}));
vi.mock('./cli', () => ({ setupCLI }));

describe('cli entry point', () => {
    afterEach(() => {
        vi.resetModules();
        vi.restoreAllMocks();
        parseAsync.mockReset();
        setupCLI.mockReset();
    });

    it('wires the program through setupCLI and parses argv', async () => {
        parseAsync.mockResolvedValue(undefined);
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await import('./index');
        await new Promise((r) => setImmediate(r));

        expect(setupCLI).toHaveBeenCalledWith(expect.objectContaining({ parseAsync }));
        expect(parseAsync).toHaveBeenCalledWith(process.argv);
        expect(exitSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('prints the error message and exits 1 when parseAsync rejects with an Error', async () => {
        parseAsync.mockRejectedValue(new Error('something exploded'));
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await import('./index');
        await new Promise((r) => setImmediate(r));

        expect(errorSpy).toHaveBeenCalledWith('\nsomething exploded');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('uses the unexpected-error path when parseAsync rejects with a value that has no message', async () => {
        parseAsync.mockRejectedValue('plain string failure');
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await import('./index');
        await new Promise((r) => setImmediate(r));

        expect(errorSpy).toHaveBeenCalledWith('\nAn unexpected error occurred:', 'plain string failure');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('uses the unexpected-error path when parseAsync rejects with a falsy value', async () => {
        parseAsync.mockRejectedValue(undefined);
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await import('./index');
        await new Promise((r) => setImmediate(r));

        expect(errorSpy).toHaveBeenCalledWith('\nAn unexpected error occurred:', undefined);
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
