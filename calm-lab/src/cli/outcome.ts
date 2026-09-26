export type OutcomeCommand = 'validate' | 'diff';

export interface CommandOutcome {
    command: OutcomeCommand;
    /** Resolved absolute paths, keyed by option attribute: { architecture } / { documentA, documentB }. */
    files: Record<string, string>;
    ok: boolean;
    errorCount: number;
    warningCount: number;
    /** What each file contained when the command ran. */
    snapshot: Record<string, string>;
}

export interface CommandEvent { type: 'command'; outcome: CommandOutcome }
