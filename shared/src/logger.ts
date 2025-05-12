import winston from 'winston';
import log from 'loglevel';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
    log(level: LogLevel, message: string): void;
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

let loggerInstance: Logger;

/**
 * Initializes a logger that works in both Node.js and browser environments.
 * @param debug - Enables debug logging if true.
 * @param label - Optional label to prefix Node.js logs.
 * @returns Logger instance
 */
export function initLogger(debug: boolean, label?: string): Logger {
    if (loggerInstance) return loggerInstance;
    if (typeof window === 'undefined') {
        return initNodeLogger(debug, label);
    } else {
        return initBrowserLogger(debug);
    }
}

/**
 * Initializes a logger for Node.js environment using winston.
 * @param debug - Whether to enable debug logging.
 * @param label - Optional label to prefix Node.js logs.
 * @returns Logger instance for Node.js.
 */
function initNodeLogger(debug: boolean, label?: string): Logger {
    const level = debug ? 'debug' : 'info';

    const winstonLogger = winston.createLogger({
        transports: [
            new winston.transports.Console({
                stderrLevels: ['error', 'warn', 'info'],
            }),
        ],
        level: level,
        format: winston.format.combine(
            winston.format.label({ label }),
            winston.format.cli(),
            winston.format.errors({ stack: true }),
            winston.format.printf(({ level, message, stack, label }) => {
                return stack
                    ? `${level} [${label}]: ${message} - ${stack}`
                    : `${level} [${label}]: ${message}`;
            })
        ),
    });

    loggerInstance = {
        log: (level: LogLevel, message: string) =>
            winstonLogger.log({ level, message }),
        debug: (msg) => winstonLogger.debug(msg),
        info: (msg) => winstonLogger.info(msg),
        warn: (msg) => winstonLogger.warn(msg),
        error: (msg) => winstonLogger.error(msg),
    };

    return loggerInstance;
}

/**
 * Initializes a logger for the browser environment using loglevel.
 * @param debug - Whether to enable debug logging.
 * @param label - Optional label to prefix logs.
 * @returns Logger instance for browser.
 */
function initBrowserLogger(debug: boolean): Logger {
    const level = debug ? 'debug' : 'info';
    log.setLevel(level);

    loggerInstance = {
        log: (level: LogLevel, message: string) => log[level](message),
        debug: (msg) => log.debug(msg),
        info: (msg) => log.info(msg),
        warn: (msg) => log.warn(msg),
        error: (msg) => log.error(msg),
    };

    return loggerInstance;
}
