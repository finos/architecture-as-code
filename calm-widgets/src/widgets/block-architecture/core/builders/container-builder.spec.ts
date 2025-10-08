import { describe, it, expect, afterEach } from 'vitest';
import { pruneEmptyContainers, buildContainerForest } from './container-builder';
import { VMFactoryProvider } from '../factories/factory-provider';
import {
    CalmNodeCanonicalModel
} from '@finos/calm-models/canonical';
import { VMLeafNode, VMContainer } from '../../types';
import { VMNodeFactory } from '../factories/vm-factory-interfaces';

describe('container-builder', () => {
    afterEach(() => {
        VMFactoryProvider.resetToDefaults();
    });

    it('pruneEmptyContainers removes empty containers recursively', () => {
        const input: VMContainer[] = [
            { id: 'c1', label: 'C1', nodes: [], containers: [{ id: 'c2', label: 'C2', nodes: [], containers: [] }] },
            { id: 'c3', label: 'C3', nodes: [{ id: 'n1', label: 'N1' }], containers: [] }
        ];
        const out = pruneEmptyContainers(input);
        expect(out.find(c => c.id === 'c1')).toBeUndefined();
        expect(out.find(c => c.id === 'c3')).toBeDefined();
    });

    it('buildContainerForest assigns nodes to containers and returns loose nodes', () => {
        const fakeNodeFactory: VMNodeFactory = {
            createLeafNode: (node: CalmNodeCanonicalModel, _renderInterfaces: boolean) => ({
                node: { id: node['unique-id'], label: node.name || node['unique-id'] },
                attachments: []
            })
        };
        VMFactoryProvider.setFactories(fakeNodeFactory, undefined);

        const nodes: CalmNodeCanonicalModel[] = [
            { 'unique-id': 'n1', name: 'One',        'node-type': 'service',  description: '' },
            { 'unique-id': 'c1', name: 'Container',  'node-type': 'system',   description: '' },
            { 'unique-id': 'n2', name: 'Two',        'node-type': 'database', description: '' }
        ];
        const parentOf = new Map<string, string>([['n1', 'c1']]);
        const containerIds = new Set<string>(['c1']);

        const { containers, attachments, looseNodes } =
            buildContainerForest(nodes, parentOf, containerIds, false);

        expect(containers).toHaveLength(1);
        expect(containers[0].id).toBe('c1');
        expect(containers[0].nodes.find((n: VMLeafNode) => n.id === 'n1')).toBeDefined();

        expect(looseNodes.find((n: VMLeafNode) => n.id === 'n2')).toBeDefined();
        expect(attachments).toHaveLength(0);
    });

    it('nodes are loose if their parent container exists but is NOT in the render set', () => {
        const fakeNodeFactory: VMNodeFactory = {
            createLeafNode: (node: CalmNodeCanonicalModel) => ({
                node: { id: node['unique-id'], label: node.name || node['unique-id'] },
                attachments: []
            })
        };
        VMFactoryProvider.setFactories(fakeNodeFactory, undefined);

        const nodes: CalmNodeCanonicalModel[] = [
            { 'unique-id': 'n1', name: 'Child',   'node-type': 'service', description: '' },
            { 'unique-id': 'c1', name: 'HiddenC', 'node-type': 'system',  description: '' }
        ];
        // n1’s parent is c1, but c1 won’t be rendered
        const parentOf = new Map<string, string>([['n1', 'c1']]);
        const containerIds = new Set<string>(); // empty — nothing rendered

        const { containers, looseNodes, attachments } =
            buildContainerForest(nodes, parentOf, containerIds, false);

        expect(containers).toHaveLength(0);               // no containers rendered
        expect(looseNodes.map(n => n.id)).toEqual(['n1', 'c1']); // both are loose
        expect(attachments).toHaveLength(0);
    });

    it('creates container → container nesting when both are rendered', () => {
        const fakeNodeFactory: VMNodeFactory = {
            createLeafNode: (node: CalmNodeCanonicalModel) => ({
                node: { id: node['unique-id'], label: node.name || node['unique-id'] },
                attachments: []
            })
        };
        VMFactoryProvider.setFactories(fakeNodeFactory, undefined);

        const nodes: CalmNodeCanonicalModel[] = [
            { 'unique-id': 'cRoot', name: 'Root',     'node-type': 'system',  description: '' },
            { 'unique-id': 'cChild','name': 'Child',  'node-type': 'system',  description: '' },
            { 'unique-id': 'leaf',  name: 'Leaf',     'node-type': 'service', description: '' }
        ];
        // cChild is child of cRoot; leaf is child of cChild
        const parentOf = new Map<string, string>([
            ['cChild', 'cRoot'],
            ['leaf',   'cChild']
        ]);
        const containerIds = new Set<string>(['cRoot', 'cChild']); // both rendered

        const { containers, looseNodes } =
            buildContainerForest(nodes, parentOf, containerIds, false);

        expect(containers).toHaveLength(1);
        expect(containers[0].id).toBe('cRoot');

        const nested = containers[0].containers.find(c => c.id === 'cChild');
        expect(nested).toBeDefined();

        expect(nested!.nodes.find(n => n.id === 'leaf')).toBeDefined();

        expect(looseNodes).toHaveLength(0);
    });
});
