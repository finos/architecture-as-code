import winston from 'winston';
import { Logger } from './logger.js';

/**
 * Winston-backed logger for Node.js. Lives in its own module so the browser entry point never
 * imports winston (and its fs/os/tty transport chain). The root entry registers this factory
 * with {@link registerNodeLoggerFactory} at module load.
 */
export function createWinstonLogger(debug: boolean, label?: string): Logger {
    const level = debug ? 'debug' : 'info';
    const winstonLogger = winston.createLogger({
        level,
        transports: [
            new winston.transports.Console({ stderrLevels: ['error', 'warn', 'info'] }),
        ],
        format: winston.format.combine(
            winston.format.label({ label }),
            winston.format.cli(),
            winston.format.errors({ stack: true }),
            winston.format.printf(({ level, message, stack, label }) =>
                stack
                    ? `${level} [${label}]: ${message} - ${stack}`
                    : `${level} [${label}]: ${message}`
            )
        ),
    });

    return {
        log: (lvl, msg) => winstonLogger.log({ level: lvl, message: msg }),
        debug: (msg) => winstonLogger.debug(msg),
        info: (msg) => winstonLogger.info(msg),
        warn: (msg) => winstonLogger.warn(msg),
        error: (msg) => winstonLogger.error(msg),
    };
}
