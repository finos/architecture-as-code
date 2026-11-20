import { describe, expect, it } from 'vitest';
import { coreIcons } from '../../../packs/icons/core.js';
import { corePack } from '../../../packs/definitions/core.js';
import { initAllPacks } from '../../../packs/index.js';
import { resolvePackNode } from '../../../packs/registry.js';
import { getCanvasNodeIconMarkup } from './CanvasNodeIcon.js';
import { DEFAULT_DETAIL_NODE_VISUAL, DETAIL_NODE_VISUALS, getDetailNodeResizeBounds, getDetailNodeVisual } from './nodeVisuals';
import { parseCALMData } from '../../transforms/calm-parser';

describe('detail node visuals and icon mapping', () => {
    it('uses the shared visual profile for built-in detail-card node types', () => {
        expect(getDetailNodeVisual('actor')).toMatchObject({
            defaultBackground: '#f8fafc',
            defaultBorder: '#333333',
            defaultIconColor: '#333333',
            iconSize: 48,
            width: 200,
            height: 80,
        });

        expect(getDetailNodeResizeBounds('actor')).toEqual({
            minWidth: 40,
            minHeight: 40,
        });

        expect(getDetailNodeVisual('system')).toBe(DEFAULT_DETAIL_NODE_VISUAL);
        expect(getDetailNodeVisual('unknown-node')).toBe(DEFAULT_DETAIL_NODE_VISUAL);
        expect(getDetailNodeResizeBounds('unknown-node')).toEqual({
            minWidth: 40,
            minHeight: 40,
        });
    });

    it('keeps the shared default visual for generic node types that are not explicitly mapped', () => {
        expect(DETAIL_NODE_VISUALS.system).toBe(DEFAULT_DETAIL_NODE_VISUAL);
        expect(DETAIL_NODE_VISUALS.ecosystem).toBe(DEFAULT_DETAIL_NODE_VISUAL);
        expect(DETAIL_NODE_VISUALS.network).toBe(DEFAULT_DETAIL_NODE_VISUAL);
    });

    it('assigns the same icon entry and card visual to the core set of node types', () => {
        const expectedTypeIds = [
            'actor',
            'system',
            'service',
            'database',
            'network',
            'webclient',
            'ecosystem',
            'ldap',
            'data-asset',
        ];

        expect(corePack.nodes.map((node) => node.typeId)).toEqual(expectedTypeIds);

        for (const typeId of expectedTypeIds) {
            expect(coreIcons[typeId]).toBeTruthy();
            expect(coreIcons[typeId]?.trim().length).toBeGreaterThan(0);
            expect(getDetailNodeVisual(typeId)).toBeTruthy();
        }
    });

    it('resolves icon markup for both core and pack-prefixed types', () => {
        initAllPacks();

        const actorIcon = getCanvasNodeIconMarkup('actor', 28);
        const lambdaIcon = getCanvasNodeIconMarkup('aws:lambda', 28);

        expect(actorIcon).not.toBeNull();
        expect(actorIcon).toContain('<svg');
        expect(actorIcon).toContain('aria-hidden="true"');
        expect(lambdaIcon).not.toBeNull();
        expect(lambdaIcon).toContain('<svg');
        expect(resolvePackNode('aws:lambda')?.icon).toContain('<svg');
    });

    it('applies the mapped detail-card dimensions for non-container nodes', () => {
        const parsed = parseCALMData({
            nodes: [
                {
                    'unique-id': 'actor-1',
                    'node-type': 'actor',
                    name: 'Actor',
                    description: 'User',
                },
                {
                    'unique-id': 'svc-1',
                    'node-type': 'service',
                    name: 'Service',
                    description: 'API',
                },
            ],
            relationships: [],
        });

        expect(parsed.nodes).toHaveLength(2);
        expect(parsed.nodes[0].width).toBe(getDetailNodeVisual('actor').width);
        expect(parsed.nodes[0].height).toBe(getDetailNodeVisual('actor').height);
        expect(parsed.nodes[1].width).toBe(getDetailNodeVisual('service').width);
        expect(parsed.nodes[1].height).toBe(getDetailNodeVisual('service').height);
    });
});
