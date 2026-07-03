/**
 * Thrown when an explicit --browser-path override is invalid (missing,
 * not a file, or fails to launch). Fatal: propagates to the CLI's
 * top-level error handler and exits the process non-zero.
 */
export class BrowserOverrideError extends Error {
    readonly recoverable = false as const;

    constructor(message: string) {
        super(message);
        this.name = 'BrowserOverrideError';
    }
}

/**
 * Thrown when no local Chromium-based browser could be launched via
 * automatic detection. Recoverable: the diagram export pass is skipped
 * and mermaid code blocks are left as-is.
 */
export class BrowserLaunchError extends Error {
    readonly recoverable = true as const;

    constructor(message: string) {
        super(message);
        this.name = 'BrowserLaunchError';
    }
}

/**
 * Thrown when a single mermaid diagram fails to render (invalid syntax
 * or timeout). Recoverable: the offending mermaid code block is left
 * as-is and processing continues with the next diagram.
 */
export class DiagramRenderError extends Error {
    readonly recoverable = true as const;

    constructor(message: string, readonly cause?: Error) {
        super(message);
        this.name = 'DiagramRenderError';
    }
}
