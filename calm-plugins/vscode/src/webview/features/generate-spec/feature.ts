import type { CanvasFeatureDefinition } from '../types';
import { notifyRequestGenerateSpec } from '../../stores/sync-bridge';

export const generateSpecFeature: CanvasFeatureDefinition = {
    id: 'generate-spec',
    toolbarActions: [
        {
            id: 'generateSpec',
            label: 'Generate Spec',
            title: 'Generate an architecture spec',
            execute: notifyRequestGenerateSpec,
            group: 'generation',
            order: 10,
            visibleWhen: 'editable',
        },
    ],
};