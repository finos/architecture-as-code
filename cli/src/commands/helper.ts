import * as winston from 'winston';

export function initLogger(debug: boolean): winston.Logger {
    const level = debug ? 'debug' : 'info';
    return winston.createLogger({
        transports: [
            new winston.transports.Console()
        ],
        level: level,
        format: winston.format.cli(),
    });
}