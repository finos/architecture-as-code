import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { ELEMENT_OF, layersLensReply, parseView, type CalmArchitecture, type LensReply, type View } from './lens.js';
import { SHOP, calmNode, connects } from './testing.js';

const schema = JSON.parse(readFileSync(new URL('../../../calm-hub/src/main/resources/META-INF/calm-extensions/schema/0/lens.schema.json', import.meta.url), 'utf8'));
const notation = JSON.parse(readFileSync(new URL('../notation.json', import.meta.url), 'utf8'));
const validate = new Ajv2020({ strict: false }).compile(schema);
const reply = (view: View, architecture: CalmArchitecture = SHOP) => {
    const value = layersLensReply(architecture, view);
    // Each reply is a reply that Hub accepts: the schema is the contract.
    expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
    return value;
};
const node = (value: LensReply, id: string) => value.graph.nodes.find((entry) => entry.id === id);
const edgeIds = (value: LensReply) => value.graph.edges.map((edge) => `${edge.tags[0]} ${edge.source}->${edge.target}`).sort();

describe('the layered view', () => {
    const value = reply('layered');

    it('puts each element in its layer, with the tags of its element type', () => {
        expect(value.graph.groups.map((group) => group.id)).toEqual(['layer:Business', 'layer:Application', 'layer:Technology']);
        expect(node(value, 'customer')).toMatchObject({ group: 'layer:Business', tags: ['Business', 'Business Actor'], calm: ['customer'] });
        expect(node(value, 'web')?.tags).toEqual(['Application', 'Application Interface']);
        expect(node(value, 'orders')?.tags).toContain('Data Object');
        expect(node(value, 'db')).toMatchObject({ group: 'layer:Technology', tags: ['Technology', 'System Software'] });
        expect(node(value, 'cluster')?.tags).toContain('Communication Network');
        expect(value.layout).toEqual({ algorithm: 'layered', direction: 'up' });
    });

    it('turns serving round, draws access to data, and draws composition and deployment as edges', () => {
        expect(edgeIds(value)).toEqual([
            'Access api->orders',
            'Assignment cluster->api',
            'Assignment cluster->db',
            'Composition shop->api',
            'Composition shop->db',
            'Composition shop->mailer',
            'Composition shop->web',
            'Serving api->web',
            'Serving db->api',
            'Serving directory->api',
            'Serving mailer->api',
            'Serving web->customer',
        ]);
        expect(value.graph.edges.find((edge) => edge.id === 'web-api')).toMatchObject({ label: 'Calls', technology: 'HTTPS', calm: ['web-api'] });
    });

    it('marks a node type that it does not know, and lists the mapping in the notes', () => {
        expect(node(value, 'mailer')).toMatchObject({ tags: ['Application', 'Application Component', 'Guessed'], badges: [{ text: 'Type guessed', tone: 'warning' }] });
        const blocks = value.panels[0].blocks;
        expect(blocks).toContainEqual({ type: 'alert', tone: 'warning', text: '1 node has a node type that the lens does not know (x:mailer), shown as application components.' });
        expect(blocks.find((block) => block.type === 'table')).toMatchObject({
            rows: [
                ['actor', 'Business Actor'], ['data-asset', 'Data Object'], ['database', 'System Software'], ['ldap', 'Technology Service'],
                ['network', 'Communication Network'], ['service', 'Application Component'], ['system', 'Application Component'],
                ['webclient', 'Application Interface'], ['x:mailer', 'Application Component'],
            ],
        });
    });
});

describe('the application cooperation view', () => {
    it('shows the application layer only, with a container drawn around its parts', () => {
        const value = reply('application');
        expect(value.graph.groups).toEqual([{ id: 'group:shop', label: 'shop', tags: ['Application Component'], calm: ['shop'] }]);
        expect(value.graph.nodes.map((entry) => `${entry.id}:${entry.group ?? '-'}`).sort()).toEqual(['api:group:shop', 'mailer:group:shop', 'orders:-', 'web:group:shop']);
        expect(edgeIds(value)).toEqual(['Access api->orders', 'Serving api->web', 'Serving mailer->api']);
        expect(value.layout.direction).toBe('right');
    });

    it('joins an edge to the group of a container, and nests containers without a cycle', () => {
        const architecture: CalmArchitecture = {
            nodes: [calmNode('a', 'system'), calmNode('b', 'system'), calmNode('c', 'service'), calmNode('billing', 'service')],
            relationships: [
                { 'unique-id': 'a-has-b', 'relationship-type': { 'composed-of': { container: 'a', nodes: ['b'] } } },
                { 'unique-id': 'b-has-c', 'relationship-type': { 'composed-of': { container: 'b', nodes: ['c'] } } },
                { 'unique-id': 'c-has-a', 'relationship-type': { 'composed-of': { container: 'c', nodes: ['a'] } } },
                connects('billing', 'a', 'Bills'),
            ],
        };
        const value = reply('application', architecture);
        expect(value.graph.groups).toEqual([
            { id: 'group:a', label: 'a', tags: ['Application Component'], calm: ['a'] },
            { id: 'group:b', label: 'b', parent: 'group:a', tags: ['Application Component'], calm: ['b'] },
        ]);
        expect(node(value, 'c')?.group).toBe('group:b');
        expect(edgeIds(value)).toEqual(['Serving group:a->billing']);
    });

    it('says so when there is nothing to show', () => {
        const value = reply('application', { nodes: [calmNode('customer', 'actor')] });
        expect(value.graph.nodes).toEqual([]);
        expect(value.panels[0].blocks).toContainEqual({ type: 'alert', tone: 'info', text: 'This architecture has no application elements to show.' });
    });
});

describe('parseView', () => {
    it('falls back to the layered view', () => {
        expect(parseView('application')).toBe('application');
        expect(parseView('matrix')).toBe('layered');
        expect(parseView(null)).toBe('layered');
    });
});

describe('the notation', () => {
    const styled = (kind: 'elements' | 'relationships' | 'groups') => new Set((notation.styles[kind] as { tag: string }[]).map((style) => style.tag));

    // A tag with no style draws as a plain box, so a renamed tag must fail here.
    it('has a style for each tag that the lens sends', () => {
        const elements = ['Business', 'Application', 'Technology', 'Guessed', ...Object.values(ELEMENT_OF).map((kind) => kind.element)];
        expect(elements.filter((tag) => !styled('elements').has(tag))).toEqual([]);
        expect(['Serving', 'Access', 'Composition', 'Assignment'].filter((tag) => !styled('relationships').has(tag))).toEqual([]);
        expect(['Business Layer', 'Application Layer', 'Technology Layer', 'Application Component', 'Grouping'].filter((tag) => !styled('groups').has(tag))).toEqual([]);
    });
});
