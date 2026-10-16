export type CliLogLevel = 'debug' | 'info' | 'warn' | 'error';

/** The CLI's winston line: `format.cli()` pads every level to the same width. */
export function logLine(level: CliLogLevel, label: string, message: string): string {
    return `${level} [${label}]:${' '.repeat(9 - level.length)}${message}`;
}
