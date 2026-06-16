import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('initLogger', () => {
    let originalWindow: typeof globalThis.window | undefined;

    beforeEach(() => {
        originalWindow = (globalThis as { window?: typeof globalThis.window }).window;
    });

    afterEach(() => {
        if (originalWindow === undefined) {
            delete (globalThis as { window?: typeof globalThis.window }).window;
        } else {
            (globalThis as { window?: typeof globalThis.window }).window = originalWindow;
        }
        vi.restoreAllMocks();
    });

    describe('node environment', () => {
        beforeEach(() => {
            delete (globalThis as { window?: typeof globalThis.window }).window;
        });

        it('returns a logger that exposes debug/info/warn/error', async () => {
            const { initLogger } = await import('./logger');
            const logger = initLogger(false);
            expect(typeof logger.debug).toBe('function');
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.log).toBe('function');
        });

        it('forwards each level method to winston with the message intact', async () => {
            const winston = (await import('winston')).default;
            const winstonSpy = {
                log: vi.fn(),
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            };
            vi.spyOn(winston, 'createLogger').mockReturnValue(
                winstonSpy as unknown as ReturnType<typeof winston.createLogger>
            );

            const { initLogger } = await import('./logger');
            const logger = initLogger(true, 'my-label');

            logger.debug('a');
            logger.info('b');
            logger.warn('c');
            logger.error('d');
            logger.log('warn', 'e');

            expect(winstonSpy.debug).toHaveBeenCalledWith('a');
            expect(winstonSpy.info).toHaveBeenCalledWith('b');
            expect(winstonSpy.warn).toHaveBeenCalledWith('c');
            expect(winstonSpy.error).toHaveBeenCalledWith('d');
            expect(winstonSpy.log).toHaveBeenCalledWith({ level: 'warn', message: 'e' });
        });
    });

    describe('browser environment', () => {
        beforeEach(() => {
            (globalThis as { window?: object }).window = {} as typeof globalThis.window;
        });

        it('returns a browser logger that delegates to loglevel', async () => {
            const log = (await import('loglevel')).default;
            const setLevelSpy = vi.spyOn(log, 'setLevel').mockImplementation(() => {});
            const debugSpy = vi.spyOn(log, 'debug').mockImplementation(() => {});
            const infoSpy = vi.spyOn(log, 'info').mockImplementation(() => {});
            const warnSpy = vi.spyOn(log, 'warn').mockImplementation(() => {});
            const errorSpy = vi.spyOn(log, 'error').mockImplementation(() => {});

            const { initLogger } = await import('./logger');
            const logger = initLogger(false);

            expect(setLevelSpy).toHaveBeenCalledWith('info');

            logger.debug('a');
            logger.info('b');
            logger.warn('c');
            logger.error('d');
            logger.log('warn', 'e');

            expect(debugSpy).toHaveBeenCalledWith('a');
            expect(infoSpy).toHaveBeenCalledWith('b');
            expect(warnSpy).toHaveBeenCalledWith('c');
            expect(errorSpy).toHaveBeenCalledWith('d');
            // .log('warn', 'e') routes to .warn
            expect(warnSpy).toHaveBeenCalledWith('e');
        });

        it('sets debug log level when debug=true', async () => {
            const log = (await import('loglevel')).default;
            const setLevelSpy = vi.spyOn(log, 'setLevel').mockImplementation(() => {});

            const { initLogger } = await import('./logger');
            initLogger(true);

            expect(setLevelSpy).toHaveBeenCalledWith('debug');
        });
    });
});
