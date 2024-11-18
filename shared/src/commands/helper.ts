import * as winston from 'winston';

export function initLogger(debug: boolean): winston.Logger {
    const level = debug ? 'debug' : 'info';
    return winston.createLogger({
        transports: [
            new winston.transports.Console()
        ],
        level: level,
        format: winston.format.combine(
            winston.format.cli(),
            winston.format.errors({ stack: true }),
            winston.format.printf(({ level, message, stack }) => {
                if (stack) {
                    return `${level}: ${message} - ${stack}`;
                }
                return `${level}: ${message}`;
            }),
        )
    });
}