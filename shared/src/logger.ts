import log from 'loglevel';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
    log(level: LogLevel, message: string): void;
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

export type NodeLoggerFactory = (debug: boolean, label?: string) => Logger;

let nodeLoggerFactory: NodeLoggerFactory | undefined;

/**
 * Registers the logger used in Node.js environments. The root entry point registers the
 * winston implementation (see `logger.node.ts`); the browser entry registers nothing and
 * therefore always uses loglevel. Calling this in a browser has no effect on behaviour because
 * `initLogger` only consults the factory when `window` is undefined.
 */
export function registerNodeLoggerFactory(factory: NodeLoggerFactory): void {
    nodeLoggerFactory = factory;
}

/**
 * Initializes a logger that works in both Node.js and browser environments.
 * @param debug - Enables debug logging if true.
 * @param label - Optional label to prefix Node.js logs.
 * @param quiet - If true, suppresses all logging output.
 * @returns Logger instance
 */
export function initLogger(debug: boolean, label?: string, quiet: boolean = false): Logger {
    if (quiet) {
        return createQuietLogger();
    }
    if (typeof window === 'undefined' && nodeLoggerFactory) {
        return nodeLoggerFactory(debug, label);
    }
    return initBrowserLogger(debug);
}

function createQuietLogger(): Logger {
    const noop = () => { };
    return { log: noop, debug: noop, info: noop, warn: noop, error: noop };
}

function initBrowserLogger(debug: boolean): Logger {
    const level = debug ? 'debug' : 'info';
    log.setLevel(level);
    return {
        log: (level: LogLevel, message: string) => log[level](message),
        debug: (msg) => log.debug(msg),
        info: (msg) => log.info(msg),
        warn: (msg) => log.warn(msg),
        error: (msg) => log.error(msg),
    };
}
