import type { CanvasFeatureDefinition } from '../types';
import { defaultNodeColours } from './node-colours';
import { NodeRoleFeatureSurface } from './NodeRoleFeatureSurface';

export const defaultColorsFeature: CanvasFeatureDefinition = {
    id: 'default-colors',
    nodeAppearanceDefaults: defaultNodeColours,
    surfaces: { 'context-menu': NodeRoleFeatureSurface },
};