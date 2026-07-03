import { calmDocumentSchema, type CalmDocument } from './types';
import { detectCalmVersion, normalizeCalmDocument, type CalmVersion } from './normalizer';
import type { ZodError } from 'zod';

/**
 * Successful parse result
 */
export interface ParseSuccess {
  success: true;
  data: CalmDocument;
  version: CalmVersion;
}

/**
 * Failed parse result with structured error details
 */
export interface ParseError {
  success: false;
  error: {
    message: string;
    issues: Array<{
      path: string;
      message: string;
      code: string;
    }>;
  };
}

/**
 * Discriminated union of parse results
 */
export type ParseResult = ParseSuccess | ParseError;

/**
 * Format Zod validation error into user-friendly structure
 */
function formatZodError(error: ZodError): ParseError['error'] {
  return {
    message: 'Invalid CALM JSON structure',
    issues: error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };
}

/**
 * Parse CALM JSON with Zod validation
 *
 * @param json - Unknown JSON data to parse
 * @returns ParseResult with success/failure discriminated union
 *
 * @example
 * ```typescript
 * const result = parseCalm(jsonData);
 * if (result.success) {
 *   console.log('Nodes:', result.data.nodes);
 * } else {
 *   console.error('Validation errors:', result.error.issues);
 * }
 * ```
 */
export function parseCalm(json: unknown): ParseResult {
  const version = detectCalmVersion(json);
  const normalized = normalizeCalmDocument(json, version);
  const result = calmDocumentSchema.safeParse(normalized);

  if (result.success) {
    return { success: true, data: result.data, version };
  }

  return { success: false, error: formatZodError(result.error) };
}

/**
 * Parse CALM JSON from string
 *
 * @param jsonString - JSON string to parse
 * @returns ParseResult with success/failure discriminated union
 *
 * @example
 * ```typescript
 * const result = parseCalmFromString(fileContents);
 * if (result.success) {
 *   console.log('Parsed CALM document');
 * } else {
 *   console.error('Parse failed:', result.error.message);
 * }
 * ```
 */
export function parseCalmFromString(jsonString: string): ParseResult {
  try {
    const json = JSON.parse(jsonString);
    return parseCalm(json);
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Invalid JSON',
        issues: [],
      },
    };
  }
}

/**
 * Parse CALM JSON from File object (browser environment)
 *
 * @param file - File object from file input or drag-and-drop
 * @returns Promise<ParseResult>
 *
 * @example
 * ```typescript
 * const result = await parseCalmFile(file);
 * if (result.success) {
 *   setAnalysis(result.data);
 * }
 * ```
 */
export async function parseCalmFile(file: File): Promise<ParseResult> {
  try {
    const text = await file.text();
    return parseCalmFromString(text);
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to read file',
        issues: [],
      },
    };
  }
}
