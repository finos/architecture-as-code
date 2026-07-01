import type { PipelineConfig } from '@/lib/agents/pipeline-generator';

// Prevent Next.js from caching this route — pipeline results change per analysis
export const dynamic = 'force-dynamic';

/**
 * Global store for the most recent pipeline result.
 * Written by POST /api/analyze after agent orchestration completes.
 */
declare global {
  var __lastPipelineResult: PipelineConfig | null | undefined;
}

/**
 * GET /api/pipeline
 *
 * Returns the most recent pipeline generation result from the last analysis run.
 * Result is stored in globalThis by POST /api/analyze.
 *
 * Response 200: { pipeline: PipelineConfig } (when available)
 * Response 200: { pipeline: null, message: string } (when not yet generated)
 */
export async function GET(): Promise<Response> {
  const pipelineResult = globalThis.__lastPipelineResult;

  if (pipelineResult != null) {
    return Response.json({ pipeline: pipelineResult });
  }

  return Response.json({
    pipeline: null,
    message: 'No pipeline result available. Run analysis first.',
  });
}
