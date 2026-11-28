import type { CanvasFeatureDefinition } from '../types';
import { PatternFeatureSurface } from './PatternFeatureSurface';
import { openPatternPicker } from './commands';

export const patternsFeature: CanvasFeatureDefinition = {
    id: 'patterns',
    toolbarActions: [
        {
            id: 'applyPattern',
            label: 'Apply Pattern',
            title: 'Apply a pattern to the canvas',
            group: 'patterns',
            order: 10,
            visibleWhen: 'editable',
            execute: () => openPatternPicker.emit('apply'),
        },
    ],
    menuActions: [
        {
            id: 'newPattern',
            label: 'New from Pattern',
            order: 10,
            visibleWhen: 'editable',
            execute: () => openPatternPicker.emit('new'),
        },
    ],
    surfaces: { modal: PatternFeatureSurface },
};