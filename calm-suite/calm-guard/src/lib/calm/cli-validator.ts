import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createRequire } from 'module';

const execFileAsync = promisify(execFile);

export interface CalmValidationError {
  message: string;
  path?: string;
}

export interface CalmValidationResult {
  valid: boolean;
  errors: CalmValidationError[];
}

/**
 * Represents the JSON output structure from the calm-cli validate command.
 * The CLI outputs an array of validation issue objects when validation fails.
 */
interface CalmCliIssue {
  message?: string;
  description?: string;
  path?: string;
  location?: string;
  severity?: string;
  [key: string]: unknown;
}

/**
 * Resolve the path to the calm-cli dist/index.js using require.resolve.
 * This works in both local dev and Vercel (no PATH lookup needed).
 */
function resolveCalmCliPath(): string {
  const require = createRequire(import.meta.url);
  return require.resolve('@finos/calm-cli/dist/index.js');
}

/**
 * Validate a CALM JSON document using the @finos/calm-cli subprocess.
 *
 * Writes the document to a temp file, invokes the calm-cli validate
 * subcommand with --format json, parses the structured output, and cleans up.
 *
 * @param calmJson - The parsed JSON object to validate (not a string)
 * @returns CalmValidationResult with valid flag and array of errors
 */
export async function validateWithCalmCli(
  calmJson: unknown,
): Promise<CalmValidationResult> {
  const tmpFile = join(tmpdir(), `calm-validate-${Date.now()}.json`);

  try {
    // Write the CALM JSON to a temp file for the CLI to read
    await writeFile(tmpFile, JSON.stringify(calmJson, null, 2), 'utf-8');

    const cliPath = resolveCalmCliPath();

    const { stdout, stderr } = await execFileAsync(
      process.execPath, // node binary — safe, no PATH lookup
      [cliPath, 'validate', '--architecture', tmpFile, '--format', 'json'],
      { timeout: 15_000 },
    );

    // The CLI outputs JSON — try to parse it
    const rawOutput = stdout.trim() || stderr.trim();

    if (!rawOutput) {
      // Empty output means validation passed
      return { valid: true, errors: [] };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      // Non-JSON output — treat as validation pass (CLI printed nothing useful)
      return { valid: true, errors: [] };
    }

    // The CLI outputs an object with issues array or a direct array of issues
    const issues = extractIssues(parsed);

    if (issues.length === 0) {
      return { valid: true, errors: [] };
    }

    const errors: CalmValidationError[] = issues.map((issue) => ({
      message: issue.message ?? issue.description ?? JSON.stringify(issue),
      path: issue.path ?? issue.location,
    }));

    return { valid: false, errors };
  } catch (error) {
    // execFile throws on non-zero exit code — check if it's a validation failure
    if (isExecError(error)) {
      const rawOutput = (error.stdout ?? '').trim() || (error.stderr ?? '').trim();

      if (rawOutput) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawOutput);
        } catch {
          // Unparseable output — return as a single error message
          return {
            valid: false,
            errors: [{ message: rawOutput.slice(0, 500) }],
          };
        }

        const issues = extractIssues(parsed);

        if (issues.length > 0) {
          return {
            valid: false,
            errors: issues.map((issue) => ({
              message: issue.message ?? issue.description ?? JSON.stringify(issue),
              path: issue.path ?? issue.location,
            })),
          };
        }
      }

      // CLI crashed with no useful output
      if (error.code === 'ETIMEDOUT') {
        return {
          valid: false,
          errors: [{ message: 'Validation timed out — CALM document may be too large' }],
        };
      }
    }

    // Re-throw unexpected errors (file write failure, etc.)
    throw error;
  } finally {
    // Always clean up the temp file
    await unlink(tmpFile).catch(() => {});
  }
}

/**
 * Extract a flat array of CalmCliIssue objects from the CLI JSON output.
 * The CLI may return: array of issues, { issues: [...] }, { errors: [...] },
 * or a nested result object.
 */
function extractIssues(parsed: unknown): CalmCliIssue[] {
  if (Array.isArray(parsed)) {
    return parsed as CalmCliIssue[];
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;

    if (Array.isArray(obj['issues'])) return obj['issues'] as CalmCliIssue[];
    if (Array.isArray(obj['errors'])) return obj['errors'] as CalmCliIssue[];
    if (Array.isArray(obj['violations'])) return obj['violations'] as CalmCliIssue[];

    // Single issue object
    if (typeof obj['message'] === 'string' || typeof obj['description'] === 'string') {
      return [obj as CalmCliIssue];
    }
  }

  return [];
}

/**
 * Type guard for execFile error objects (which include stdout/stderr).
 */
interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
  code?: string | number;
}

function isExecError(error: unknown): error is ExecError {
  return error instanceof Error && ('stdout' in error || 'stderr' in error);
}
