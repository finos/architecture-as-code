import type { CanvasFeatureDefinition } from '../types';
import {
    notifyRequestExportBundle,
    notifyRequestImportBundle,
    notifyRequestImportSvg,
} from '../../stores/sync-bridge';
import { ImportExportFeatureSurface } from './ImportExportFeatureSurface';
import { requestSvgExport } from './commands';

export const importExportFeature: CanvasFeatureDefinition = {
    id: 'import-export',
    toolbarActions: [
        { id: 'exportSvg', label: 'Export SVG', title: 'Export the canvas as an SVG', group: 'import-export', order: 10, execute: () => requestSvgExport.emit() },
        { id: 'importSvg', label: 'Import SVG', title: 'Import an SVG diagram as CALM architecture', group: 'import-export', order: 20, visibleWhen: 'editable', execute: notifyRequestImportSvg },
        { id: 'exportBundle', label: 'Export Bundle', title: 'Export CALM bundle (ZIP with dependencies)', group: 'import-export', order: 30, execute: notifyRequestExportBundle },
        { id: 'importBundle', label: 'Import Bundle', title: 'Import CALM bundle (ZIP archive)', group: 'import-export', order: 40, execute: notifyRequestImportBundle },
    ],
    surfaces: { overlay: ImportExportFeatureSurface },
};