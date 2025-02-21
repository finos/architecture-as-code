import * as winston from 'winston';

export function initLogger(debug: boolean, label?: string): winston.Logger {
    const level = debug ? 'debug' : 'info';
    return winston.createLogger({
        transports: [
            new winston.transports.Console({
                //This seems odd, but we want to allow users to parse JSON output from the STDOUT. We can't do that if it's polluted.
                stderrLevels: ['error', 'warn', 'info']
            })
        ],
        level: level,
        format: winston.format.combine(
            winston.format.label({ label}),
            winston.format.cli(),
            winston.format.errors({ stack: true }),
            winston.format.printf(({ level, message, stack, label }) => {
                if (stack) {
                    return `${level} [${label}]: ${message} - ${stack}`;
                }
                return `${level} [${label}]: ${message}`;
            }),
        )
    });
}