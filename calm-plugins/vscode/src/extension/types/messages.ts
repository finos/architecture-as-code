/**
 * Solution metadata surfaced when drilling into a governed building block that
 * links to a CALM solution. Shape matches calm-hub-ui's
 * `visualizer/contracts/editor-contracts.ts` `SolutionMetadata` so the two
 * editors stay protocol-compatible.
 */
export interface SolutionMetadata {
    id?: string;
    name: string;
    disposition?: string;
    dispositionGuidance?: string;
    coreAndCommon?: string;
    capabilities?: string;
    reuseModel?: string;
    provider?: string;
    resources?: string;
}

export type ExtToWebviewMessage =
    | {
          type: 'modelUpdated';
          json: string;
          source: 'file' | 'ai' | 'text-editor';
      }
    | { type: 'templatesLoaded'; templates: unknown[] }
    | { type: 'patternsLoaded'; patterns: unknown[] }
    | { type: 'buildingBlocksLoaded'; nodes: unknown[] }
    | { type: 'standardsLoaded'; standards: unknown[] }
    | { type: 'standardProse'; url: string; prose: string }
    | {
          type: 'drillResult';
          json: string;
          label: string;
          filePath: string;
          readonly?: boolean;
          solution?: SolutionMetadata;
      };

export type WebviewToExtMessage =
    | { type: 'ready' }
    | { type: 'canvasChanged'; json: string }
    | { type: 'drillInto'; label: string; path: string; calmType: string }
    | { type: 'drillUp'; index: number; filePath?: string; readonly?: boolean }
    | { type: 'requestStandardProse'; url: string }
    | { type: 'requestGenerateSpec' }
    | { type: 'saveBuildingBlock'; filename: string; content: string }
    | { type: 'exportDiagram'; format: 'svg' | 'png'; data: string };
