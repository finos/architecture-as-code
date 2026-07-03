import { type NextRequest } from 'next/server';
import { parseCalm } from '@/lib/calm/parser';
import { extractAnalysisInput } from '@/lib/calm/extractor';
import { agentEventEmitter } from '@/lib/ai/streaming';
import { runAnalysis } from '@/lib/agents/orchestrator';
import { analyzeRequestSchema } from '@/lib/api/schemas';
import '@/lib/github/globals';

// Prevent Next.js from caching this route — required for SSE
export const dynamic = 'force-dynamic';

// Enable Vercel Fluid Compute 300-second timeout for SSE streaming in production
export const maxDuration = 300;

/**
 * POST /api/analyze
 *
 * SSE streaming endpoint — runs 4 AI agents over a CALM architecture definition
 * and streams AgentEvents in real-time as agents execute.
 *
 * Request body: { calm: unknown }
 * Response: text/event-stream — sequence of SSE frames:
 *   data: <AgentEvent JSON>\n\n   (during execution)
 *   data: { type: "done", result: AnalysisResult }\n\n   (on success)
 *   data: { type: "error", message: string }\n\n   (on catastrophic failure)
 *
 * IMPORTANT: runAnalysis() is called inside ReadableStream.start() callback.
 * The Response is returned synchronously — streaming begins immediately.
 */
export async function POST(req: NextRequest): Promise<Response> {
  // 1. Parse and validate request body
  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 },
    );
  }

  const bodyResult = analyzeRequestSchema.safeParse(bodyRaw);
  if (!bodyResult.success) {
    return Response.json(
      { error: 'Invalid request body', issues: bodyResult.error.issues },
      { status: 400 },
    );
  }

  // 2. Parse and validate CALM document
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

  // 3. Extract selected frameworks, demoMode, and learning params from request body
  const selectedFrameworks = bodyResult.data.frameworks;
  const demoMode = bodyResult.data.demoMode;
  const deterministicRules = bodyResult.data.deterministicRules;
  const learningContext = bodyResult.data.learningContext;

  // 4. Extract structured analysis input from CALM document
  const analysisInput = extractAnalysisInput(parseResult.data);

  // 5. Create SSE encoder
  const encoder = new TextEncoder();

  // 6. Build the ReadableStream — agents run inside start() so the Response
  //    is returned synchronously and streaming begins immediately
  const stream = new ReadableStream({
    async start(controller) {
      // Subscribe to agent events BEFORE running analysis
      const unsubscribe = agentEventEmitter.subscribe((event) => {
        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (err) {
          console.error('[POST /api/analyze] Failed to enqueue event:', err);
        }
      });

      try {
        // Run the full 4-agent orchestration — events stream as they happen
        const result = await runAnalysis(analysisInput, selectedFrameworks, demoMode, deterministicRules, learningContext);

        // Store pipeline result and full analysis state for PR generation routes
        globalThis.__lastPipelineResult = result.pipeline;
        globalThis.__lastCloudInfraResult = result.cloudInfra;
        globalThis.__lastAnalysisResult = result;
        globalThis.__lastCalmDocument = parseResult.data;

        // Send terminal done event
        const doneEvent = JSON.stringify({ type: 'done', result });
        controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error('[POST /api/analyze] Analysis failed:', error);

        // Send terminal error event
        const errorEvent = JSON.stringify({
          type: 'error',
          message: errorMessage,
        });
        controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
      } finally {
        // Always clean up subscription and close stream
        unsubscribe();
        controller.close();
      }
    },
  });

  // 7. Return SSE response — headers required for proper streaming
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
