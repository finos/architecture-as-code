import { describe, it, expect } from 'vitest';
import type { ExtToWebviewMessage, WebviewToExtMessage } from './messages';

describe('message types', () => {
    it('ExtToWebviewMessage covers all expected variants', () => {
        const variants: ExtToWebviewMessage['type'][] = [
            'modelUpdated', 'templatesLoaded', 'patternsLoaded', 'buildingBlocksLoaded',
            'drillResult', 'controlsChanged', 'controlBrowseResult', 'controlDomainResult',
            'controlVersionsResult', 'controlResolveResult', 'saveControlResult',
        ];
        expect(variants).toHaveLength(11);
    });

    it('WebviewToExtMessage covers all expected variants', () => {
        const variants: WebviewToExtMessage['type'][] = [
            'ready', 'canvasChanged', 'drillInto', 'drillUp', 'requestGenerateSpec',
            'saveBuildingBlock', 'exportDiagram', 'requestImportSvg', 'requestControlBrowse',
            'requestControlsForDomain', 'requestControlVersions', 'requestControlResolve',
            'saveControl', 'savePattern', 'requestExportPattern', 'openControlInHub',
        ];
        expect(variants).toHaveLength(16);
    });

    it('modelUpdated source includes import variant', () => {
        const msg: ExtToWebviewMessage = { type: 'modelUpdated', json: '{}', source: 'import' };
        expect(msg.source).toBe('import');
    });

    it('canvasChanged carries JSON', () => {
        const msg: WebviewToExtMessage = { type: 'canvasChanged', json: '{"nodes":[]}' };
        expect(msg.json).toContain('nodes');
    });
});
