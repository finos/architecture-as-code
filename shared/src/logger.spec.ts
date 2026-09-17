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

        it('falls back to loglevel when no node logger factory is registered', async () => {
            vi.resetModules();
            const log = (await import('loglevel')).default;
            vi.spyOn(log, 'setLevel').mockImplementation(() => {});
            const infoSpy = vi.spyOn(log, 'info').mockImplementation(() => {});
            const { initLogger } = await import('./logger');
            initLogger(false).info('hello');
            expect(infoSpy).toHaveBeenCalledWith('hello');
        });

        it('uses the registered node logger factory', async () => {
            vi.resetModules();
            const { initLogger, registerNodeLoggerFactory } = await import('./logger');
            const fake = { log: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
            const factory = vi.fn(() => fake);
            registerNodeLoggerFactory(factory);
            const logger = initLogger(true, 'my-label');
            logger.info('b');
            expect(factory).toHaveBeenCalledWith(true, 'my-label');
            expect(fake.info).toHaveBeenCalledWith('b');
        });

        it('ignores the registered factory when quiet=true', async () => {
            vi.resetModules();
            const { initLogger, registerNodeLoggerFactory } = await import('./logger');
            const factory = vi.fn();
            registerNodeLoggerFactory(factory);
            const logger = initLogger(true, 'x', true);
            logger.info('silent');
            expect(factory).not.toHaveBeenCalled();
        });

        it('createWinstonLogger forwards each level method to winston with the message intact', async () => {
            vi.resetModules();
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

            const { createWinstonLogger } = await import('./logger.node');
            const logger = createWinstonLogger(true, 'my-label');

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

        it('the root barrel registers winston as the node logger', async () => {
            vi.resetModules();
            const winston = (await import('winston')).default;
            const createLogger = vi.spyOn(winston, 'createLogger');
            const { initLogger } = await import('./index');
            initLogger(false, 'via-barrel');
            expect(createLogger).toHaveBeenCalled();
        });
    });

    describe('browser environment', () => {
        beforeEach(() => {
            (globalThis as { window?: object }).window = {} as typeof globalThis.window;
        });

        it('returns a browser logger that delegates to loglevel', async () => {
            vi.resetModules();
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
            vi.resetModules();
            const log = (await import('loglevel')).default;
            const setLevelSpy = vi.spyOn(log, 'setLevel').mockImplementation(() => {});

            const { initLogger } = await import('./logger');
            initLogger(true);

            expect(setLevelSpy).toHaveBeenCalledWith('debug');
        });
    });
});
