import { type NextRequest } from 'next/server';
import { parseCalm } from '@/lib/calm/parser';
import { extractAnalysisInput } from '@/lib/calm/extractor';
import { parseRequestSchema } from '@/lib/api/schemas';

/**
 * POST /api/calm/parse
 *
 * Validates and parses a CALM JSON document without running agents.
 * Useful for pre-flight validation before triggering analysis.
 *
 * Request body: { calm: unknown }
 * Response 200: { success: true, data: AnalysisInput }
 * Response 400: { error: string, details?: ParseError }
 */
export async function POST(req: NextRequest): Promise<Response> {
  // 1. Parse request body
  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 },
    );
  }

  // 2. Validate request schema
  const bodyResult = parseRequestSchema.safeParse(bodyRaw);
  if (!bodyResult.success) {
    return Response.json(
      { error: 'Invalid request body', issues: bodyResult.error.issues },
      { status: 400 },
    );
  }

  // 3. Parse and validate CALM document
  const parseResult = parseCalm(bodyResult.data.calm);
  if (!parseResult.success) {
    return Response.json(
      {
        error: 'Invalid CALM document',
        details: parseResult.error,
      },
      { status: 400 },
    );
  }

  // 4. Extract structured analysis input
  const analysisInput = extractAnalysisInput(parseResult.data);

  // 5. Return successful parse result
  return Response.json({ success: true, data: analysisInput, version: parseResult.version });
}
