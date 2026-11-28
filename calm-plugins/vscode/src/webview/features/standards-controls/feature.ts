import type { CanvasFeatureDefinition } from '../types';
import { StandardsControlsPropertiesSurface } from './StandardsControlsPropertiesSurface';
import { StandardsControlsModalSurface } from './StandardsControlsModalSurface';
import { useStandardsControlsUi } from './state';
import { handleStandardNodeDrop } from './drop';
import { StandardsControlsPaletteSurface } from './StandardsControlsPaletteSurface';

export const standardsControlsFeature: CanvasFeatureDefinition = {
    id: 'standards-controls',
    menuActions: [
        {
            id: 'createStandardNode',
            label: 'Create Node',
            order: 20,
            visibleWhen: 'editable',
            execute: () => useStandardsControlsUi.getState().setShowStandardNodeCreator(true),
        },
        {
            id: 'createControl',
            label: 'Create Control',
            order: 30,
            visibleWhen: 'editable',
            execute: () => useStandardsControlsUi.getState().setShowControlCreator(true),
        },
    ],
    surfaces: {
        properties: StandardsControlsPropertiesSurface,
        palette: StandardsControlsPaletteSurface,
        modal: StandardsControlsModalSurface,
    },
    onDrop: handleStandardNodeDrop,
};