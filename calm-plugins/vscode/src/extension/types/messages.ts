/**
 * Solution metadata surfaced when drilling into a governed building block that
 * links to a CALM solution. Shape matches calm-hub-ui's
 * `visualizer/contracts/editor-contracts.ts` `SolutionMetadata` so the two
 * editors stay protocol-compatible.
 */
import type { ParsedRequirement } from '../services/requirement-parser';
import type { ControlBrowseGroup } from '../services/control-asset-service';

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

/**
 * Flattened ADR entry surfaced to the webview. ADR ids are only unique within a
 * namespace, so `namespace` is part of the identity.
 */
export interface AdrEntry {
    namespace: string;
    id: number;
    title: string;
    status: string;
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
    | { type: 'adrsLoaded'; adrs: AdrEntry[] }
    | { type: 'standardProse'; url: string; prose: string }
    | {
          type: 'drillResult';
          json: string;
          label: string;
          filePath: string;
          readonly?: boolean;
          solution?: SolutionMetadata;
      }
    | {
          type: 'definitionResolved';
          nodeId: string;
          controls: Record<string, unknown>;
      }
    | {
          type: 'definitionResolutionFailed';
          nodeId: string;
          error: string;
      }
    | {
          type: 'updatesAvailable';
          updates: Array<{
              nodeId: string;
              currentSha: string;
              latestSha: string;
          }>;
      }
    | { type: 'controlsChanged' }
    | { type: 'controlBrowseResult'; requestId: string; ok: true; groups: ControlBrowseGroup[] }
    | { type: 'controlBrowseResult'; requestId: string; ok: false; error: string }
    | { type: 'controlDomainResult'; requestId: string; ok: true; group: ControlBrowseGroup }
    | { type: 'controlDomainResult'; requestId: string; ok: false; error: string }
    | { type: 'controlVersionsResult'; requestId: string; ok: true; versions: string[] }
    | { type: 'controlVersionsResult'; requestId: string; ok: false; error: string }
    | {
          type: 'controlResolveResult';
          requestId: string;
          ok: true;
          parsed: ParsedRequirement;
          warnings: string[];
      }
    | { type: 'controlResolveResult'; requestId: string; ok: false; error: string }
    | { type: 'saveControlResult'; requestId: string; ok: true }
    | { type: 'saveControlResult'; requestId: string; ok: false; error: string };

export type WebviewToExtMessage =
    | { type: 'ready' }
    | { type: 'canvasChanged'; json: string }
    | { type: 'drillInto'; label: string; path: string; calmType: string }
    | { type: 'drillUp'; index: number; filePath?: string; readonly?: boolean }
    | { type: 'requestStandardProse'; url: string }
    | { type: 'requestGenerateSpec' }
    | { type: 'saveBuildingBlock'; filename: string; content: string }
    | { type: 'exportDiagram'; format: 'svg' | 'png'; data: string }
    | { type: 'resolveDefinitionId'; nodeId: string; curie: string }
    | { type: 'requestImportSvg' }
    | { type: 'requestControlBrowse'; requestId: string }
    | { type: 'requestControlsForDomain'; requestId: string; domain: string }
    | {
          type: 'requestControlVersions';
          requestId: string;
          domain: string;
          controlName: string;
      }
    | { type: 'requestControlResolve'; requestId: string; ref: string }
    | { type: 'saveControl'; requestId: string; filename: string; content: string };
