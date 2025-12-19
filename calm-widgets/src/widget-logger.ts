/**
 * Simple logger interface for widgets.
 * Can be configured by the host application (e.g., VSCode extension)
 * to route logs to the appropriate output.
 */
export interface WidgetLogger {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

/**
 * Default logger that does nothing (silent).
 * Replace with setWidgetLogger() to enable logging.
 */
const silentLogger: WidgetLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
};

let currentLogger: WidgetLogger = silentLogger;

/**
 * Set a custom logger for widgets.
 * Call this from your application to route widget logs to your logging system.
 * 
 * @example
 * // In VSCode extension:
 * setWidgetLogger({
 *   debug: (msg) => outputChannel.appendLine(`[DEBUG] ${msg}`),
 *   info: (msg) => outputChannel.appendLine(`[INFO] ${msg}`),
 *   warn: (msg) => outputChannel.appendLine(`[WARN] ${msg}`),
 *   error: (msg) => outputChannel.appendLine(`[ERROR] ${msg}`),
 * });
 */
export function setWidgetLogger(logger: WidgetLogger): void {
    currentLogger = logger;
}

/**
 * Get the current widget logger.
 */
export function getWidgetLogger(): WidgetLogger {
    return currentLogger;
}
