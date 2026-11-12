import type { CanvasFeatureDefinition } from '../types';
import { ResponsiveNode } from './ResponsiveNode';

const responsiveNodeTypes = [
    'service',
    'actor',
    'database',
    'webclient',
    'system',
    'ecosystem',
    'network',
    'ldap',
    'data-asset',
    'extension',
];

export const nodeAppearanceFeature: CanvasFeatureDefinition = {
    id: 'node-appearance',
    nodeTypes: Object.fromEntries(responsiveNodeTypes.map((type) => [type, ResponsiveNode])),
};