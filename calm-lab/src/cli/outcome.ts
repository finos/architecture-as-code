export type OutcomeCommand = 'validate' | 'generate' | 'diff';

export interface CommandOutcome {
    command: OutcomeCommand;
    /** Resolved absolute paths: { architecture, pattern, mapping } / { pattern, output, mapping } / { documentA, documentB }. */
    files: Record<string, string>;
    ok: boolean;
    errorCount: number;
    warningCount: number;
    /** validate only: the error count per `source` of the report (`architecture`, `pattern`, or `other`). */
    errorsIn?: Record<string, number>;
    /** validate only: how many pattern `$ref`s failed to load. */
    loadFailures?: number;
    /** What each file contained when the command ran; null for a file it looked for and did not find. */
    snapshot: Record<string, string | null>;
}

export interface CommandEvent { type: 'command'; outcome: CommandOutcome }
