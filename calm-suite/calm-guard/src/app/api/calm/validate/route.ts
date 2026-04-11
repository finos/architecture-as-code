import { type NextRequest } from 'next/server';
import { validateWithCalmCli } from '@/lib/calm/cli-validator';

// REQUIRED: child_process is not available in Edge Runtime
export const runtime = 'nodejs';

/**
 * POST /api/calm/validate
 *
 * Validates a CALM JSON document using the @finos/calm-cli subprocess.
 *
 * Request body: { calm: unknown }
 * Response:     CalmValidationResult { valid: boolean, errors: Array<{ message, path? }> }
 *
 * Returns 200 for both valid and invalid documents (errors are in the body).
 * Returns 400 for malformed request bodies.
 * Returns 500 on unexpected validation service errors.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      {
        valid: false,
        errors: [{ message: 'Invalid JSON in request body' }],
      },
      { status: 400 },
    );
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('calm' in (body as object))
  ) {
    return Response.json(
      {
        valid: false,
        errors: [{ message: 'Request body must be { calm: object }' }],
      },
      { status: 400 },
    );
  }

  const { calm } = body as { calm: unknown };

  try {
    const result = await validateWithCalmCli(calm);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[POST /api/calm/validate] Validation service error:', error);

    return Response.json(
      {
        valid: false,
        errors: [{ message: `Validation service error: ${message}` }],
      },
      { status: 500 },
    );
  }
}
