import type { PipelineConfig } from '@/lib/agents/pipeline-generator';
import type { AnalysisResult } from '@/lib/agents/orchestrator';
import type { CalmDocument } from '@/lib/calm/types';
import type { CloudInfraConfig } from '@/lib/agents/cloud-infra-generator';

/**
 * Shared global type declarations for cross-route server state.
 *
 * Import this file in any API route that reads or writes these globals:
 *   import '@/lib/github/globals';
 *
 * NEVER import this in client components — globals are server-side only.
 */
declare global {

  var __lastPipelineResult: PipelineConfig | null | undefined;

  var __lastAnalysisResult: AnalysisResult | null | undefined;

  var __lastCalmDocument: CalmDocument | null | undefined;

  var __lastCloudInfraResult: CloudInfraConfig | null | undefined;
}

export {}; // Ensure this is treated as a module
