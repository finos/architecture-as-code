export type OutcomeCommand = 'validate' | 'generate' | 'diff';

export interface CommandOutcome {
    command: OutcomeCommand;
    /** Resolved absolute paths: { architecture, pattern, mapping } / { pattern, output, mapping } / { documentA, documentB }. */
    files: Record<string, string>;
    ok: boolean;
    errorCount: number;
    warningCount: number;
    /** What each file contained when the command ran. */
    snapshot: Record<string, string>;
}

export interface CommandEvent { type: 'command'; outcome: CommandOutcome }
