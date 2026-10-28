import { describe, it, expect, beforeEach } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { flowToCalm, setLastParsedArch, type CalmArchitecture } from './calm-editor-transformer';
import { parseCALMData } from './calm-parser';

describe('flowToCalm - definition-id handling', () => {
    beforeEach(() => {
        setLastParsedArch(null);
    });

    it('writes definition-id and omits controls/metadata for Hub-sourced nodes', () => {
        const nodes: Node[] = [
            {
                id: 'svc-1',
                type: 'service',
                position: { x: 0, y: 0 },
                data: {
                    calmId: 'svc-1',
                    calmType: 'service',
                    label: 'Payment Service',
                    description: 'Handles payments',
                    interfaces: [{ id: 'iface-1', protocol: 'https' }],
                    'definition-id': 'finos:standard-nodes:microservice@abc123',
                },
            },
        ];
        const edges: Edge[] = [];

        const arch = flowToCalm(nodes, edges);

        expect(arch.nodes).toHaveLength(1);
        const calmNode = arch.nodes[0];
        expect(calmNode['definition-id']).toBe(
            'finos:standard-nodes:microservice@abc123'
        );
        expect(calmNode['unique-id']).toBe('svc-1');
        expect(calmNode.name).toBe('Payment Service');
        expect(calmNode.interfaces).toEqual([
            { id: 'iface-1', protocol: 'https' },
        ]);
        // Controls and metadata should NOT be present
        expect(calmNode.controls).toBeUndefined();
        expect(calmNode.metadata).toBeUndefined();
    });

    it('writes controls and metadata for local nodes (no definition-id)', () => {
        const nodes: Node[] = [
            {
                id: 'svc-2',
                type: 'service',
                position: { x: 100, y: 100 },
                data: {
                    calmId: 'svc-2',
                    calmType: 'service',
                    label: 'Local Service',
                    description: 'A locally defined service',
                    interfaces: [],
                    controls: { 'app-id': { description: 'App ID' } },
                    metadata: { 'source-standard-node': 'microservice' },
                },
            },
        ];
        const edges: Edge[] = [];

        const arch = flowToCalm(nodes, edges);

        expect(arch.nodes).toHaveLength(1);
        const calmNode = arch.nodes[0];
        expect(calmNode['definition-id']).toBeUndefined();
        expect(calmNode.controls).toEqual({
            'app-id': { description: 'App ID' },
        });
        expect(calmNode.metadata).toEqual({
            'source-standard-node': 'microservice',
        });
    });

    it('handles a mix of Hub-sourced and local nodes', () => {
        const nodes: Node[] = [
            {
                id: 'hub-node',
                type: 'service',
                position: { x: 0, y: 0 },
                data: {
                    calmId: 'hub-node',
                    calmType: 'service',
                    label: 'Hub Node',
                    description: '',
                    'definition-id': 'acme:standard-nodes:api-gateway@sha256',
                },
            },
            {
                id: 'local-node',
                type: 'database',
                position: { x: 200, y: 0 },
                data: {
                    calmId: 'local-node',
                    calmType: 'database',
                    label: 'Local DB',
                    description: '',
                    controls: { encryption: { description: 'AES256' } },
                    metadata: { 'source-standard-node': 'rds' },
                },
            },
        ];
        const edges: Edge[] = [];

        const arch = flowToCalm(nodes, edges);

        expect(arch.nodes).toHaveLength(2);

        const hubCalm = arch.nodes.find(
            (n) => n['unique-id'] === 'hub-node'
        )!;
        expect(hubCalm['definition-id']).toBe(
            'acme:standard-nodes:api-gateway@sha256'
        );
        expect(hubCalm.controls).toBeUndefined();
        expect(hubCalm.metadata).toBeUndefined();

        const localCalm = arch.nodes.find(
            (n) => n['unique-id'] === 'local-node'
        )!;
        expect(localCalm['definition-id']).toBeUndefined();
        expect(localCalm.controls).toEqual({
            encryption: { description: 'AES256' },
        });
        expect(localCalm.metadata).toEqual({
            'source-standard-node': 'rds',
        });
    });

    it('preserves details on Hub-sourced nodes', () => {
        const nodes: Node[] = [
            {
                id: 'n1',
                type: 'system',
                position: { x: 0, y: 0 },
                data: {
                    calmId: 'n1',
                    calmType: 'system',
                    label: 'System',
                    description: '',
                    'definition-id': 'org:standard-nodes:platform@v1',
                    details: { 'detailed-architecture': 'sub-arch.calm.json' },
                },
            },
        ];

        const arch = flowToCalm(nodes, []);
        const calmNode = arch.nodes[0];
        expect(calmNode['definition-id']).toBe(
            'org:standard-nodes:platform@v1'
        );
        expect(calmNode.details).toEqual({
            'detailed-architecture': 'sub-arch.calm.json',
        });
    });

    it('stripResolvedNoise preserves description and config-url on controls', () => {
        const nodes: Node[] = [{
            id: 'svc-hub',
            type: 'service',
            position: { x: 0, y: 0 },
            data: {
                calmId: 'svc-hub',
                calmType: 'service',
                label: 'Hub Service',
                description: 'From Hub',
                'definition-id': 'finos:standard-nodes:svc@abc',
                controls: {
                    'platform--encryption': {
                        description: 'Data at rest encryption',
                        requirements: [{
                            'requirement-url': 'platform:controls:encryption@1.0.0',
                            'config-url': 'https://hub/config.json',
                        }],
                        metadata: { validation: { identity: { controlId: 'encryption' }, properties: {} } },
                    },
                },
            },
        }];

        const arch = flowToCalm(nodes, []);
        const ctrl = arch.nodes[0].controls as Record<string, any>;
        expect(ctrl['platform--encryption'].description).toBe('Data at rest encryption');
        expect(ctrl['platform--encryption'].requirements[0]['config-url']).toBe('https://hub/config.json');
        expect(ctrl['platform--encryption'].requirements[0]['requirement-url']).toBe('platform:controls:encryption@1.0.0');
        expect(ctrl['platform--encryption'].metadata).toBeUndefined();
    });

    it('preserves metadata on definition-id nodes', () => {
        const nodes: Node[] = [{
            id: 'svc-meta',
            type: 'service',
            position: { x: 0, y: 0 },
            data: {
                calmId: 'svc-meta',
                calmType: 'service',
                label: 'Styled Hub Node',
                description: '',
                'definition-id': 'finos:standard-nodes:svc@abc',
                metadata: { 'standard-node-style': { background: '#1c4587' } },
            },
        }];

        const arch = flowToCalm(nodes, []);
        expect(arch.nodes[0].metadata).toEqual({ 'standard-node-style': { background: '#1c4587' } });
    });
});


describe('flowToCalm - round trip', () => {
    const fullArchitecture = (): CalmArchitecture => ({
        $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
        'unique-id': 'round-trip',
        name: 'Round trip',
        description: 'Uses each optional field',
        adrs: ['https://example.com/adr/1'],
        nodes: [
            {
                'unique-id': 'cluster',
                'node-type': 'system',
                name: 'Cluster',
                description: 'Holds the services',
                'run-as': 'k8s',
                metadata: { region: 'eu' },
            },
            {
                'unique-id': 'user',
                'node-type': 'actor',
                name: 'User',
                description: 'A person',
            },
            {
                'unique-id': 'api',
                'node-type': 'service',
                name: 'API',
                description: 'Serves requests',
                'development-language': 'TypeScript',
                'data-classification': 'Confidential',
                instance: 'api-1',
                interfaces: [{ 'unique-id': 'api-http', port: 443 }],
                controls: { security: { description: 'TLS', requirements: [{ 'requirement-url': 'https://example.com/tls' }] } },
                details: { 'detailed-architecture': 'https://example.com/api.json' },
                metadata: { owner: 'team-a' },
            },
            {
                'unique-id': 'db',
                'node-type': 'database',
                name: 'DB',
                description: 'Stores data',
                interfaces: [{ 'unique-id': 'db-sql', port: 5432 }],
            },
        ],
        relationships: [
            {
                'unique-id': 'api-db',
                description: 'Reads data',
                protocol: 'JDBC',
                authentication: 'OAuth2',
                'relationship-type': {
                    connects: {
                        source: { node: 'api', interfaces: ['api-http'] },
                        destination: { node: 'db', interfaces: ['db-sql'] },
                    },
                },
                controls: { audit: { description: 'Logged', requirements: [{ 'requirement-url': 'https://example.com/audit' }] } },
                metadata: { 'line-style': 'dashed', criticality: 'high' },
            },
            {
                'unique-id': 'user-api',
                description: 'Calls the API',
                protocol: 'HTTPS',
                'relationship-type': { interacts: { actor: 'user', nodes: ['api', 'db'] } },
                controls: { access: { description: 'SSO', requirements: [{ 'requirement-url': 'https://example.com/sso' }] } },
                metadata: { channel: 'web' },
            },
            {
                'unique-id': 'cluster-contents',
                description: 'Services run in the cluster',
                'relationship-type': { 'deployed-in': { container: 'cluster', nodes: ['db', 'api'] } },
                metadata: { zone: 'a' },
            },
            {
                'unique-id': 'api-pending',
                description: 'Destination not chosen yet',
                'relationship-type': { connects: { source: { node: 'api' }, destination: { interfaces: ['db-sql'] } } },
            },
            {
                'unique-id': 'api-observes-db',
                description: 'Custom type',
                'relationship-type': { observes: { source: { node: 'api', interfaces: ['api-http'] }, destination: { node: 'db' } } },
            },
        ],
        flows: ['https://example.com/flow/1'],
        controls: { governance: { description: 'Doc control', requirements: [{ 'requirement-url': 'https://example.com/gov' }] } },
        metadata: { version: '1.0.0' },
    });

    function openCanvas(arch: CalmArchitecture) {
        setLastParsedArch(arch);
        return parseCALMData(arch);
    }

    function withoutLayout(arch: CalmArchitecture): CalmArchitecture {
        const { _layout, ...metadata } = arch.metadata as Record<string, unknown>;
        return { ...arch, metadata };
    }

    const relationship = (arch: CalmArchitecture, id: string) =>
        arch.relationships.find((r) => r['unique-id'] === id) as Record<string, any>;

    beforeEach(() => {
        setLastParsedArch(null);
    });

    it('writes the same document when the canvas changes nothing', () => {
        const original = fullArchitecture();
        const { nodes, edges } = openCanvas(fullArchitecture());

        const result = flowToCalm(nodes, edges, original.controls as Record<string, unknown>);

        expect(JSON.stringify(withoutLayout(result), null, 2)).toBe(JSON.stringify(original, null, 2));
    });

    it('applies canvas edits and keeps the other fields', () => {
        const { nodes, edges } = openCanvas(fullArchitecture());
        const api = nodes.find((n) => n.id === 'api')!;
        api.data = { ...api.data, description: 'Edited', details: undefined };
        const apiDb = edges.find((e) => e.id === 'api-db')!;
        apiDb.data = { ...apiDb.data, protocol: 'TLS' };

        const result = flowToCalm(nodes, edges);

        const apiNode = result.nodes.find((n) => n['unique-id'] === 'api')!;
        expect(apiNode.description).toBe('Edited');
        expect(apiNode.details).toBeUndefined();
        expect(apiNode['development-language']).toBe('TypeScript');
        const rel = relationship(result, 'api-db');
        expect(rel.protocol).toBe('TLS');
        expect(rel.authentication).toBe('OAuth2');
        expect(rel['relationship-type'].connects.source.interfaces).toEqual(['api-http']);
    });

    it('removes the interfaces of an end that is connected to a different node', () => {
        const { nodes, edges } = openCanvas(fullArchitecture());
        const apiDb = edges.find((e) => e.id === 'api-db')!;
        apiDb.target = 'cluster';

        const ends = relationship(flowToCalm(nodes, edges), 'api-db')['relationship-type'].connects;

        expect(ends.source).toEqual({ node: 'api', interfaces: ['api-http'] });
        expect(ends.destination).toEqual({ node: 'cluster' });
    });

    it('keeps relationships that the canvas does not draw, and removes deleted edges', () => {
        const { nodes, edges } = openCanvas(fullArchitecture());

        const result = flowToCalm(nodes, edges.filter((e) => e.id !== 'api-db'));

        expect(relationship(result, 'api-pending')).toEqual(fullArchitecture().relationships[3]);
        expect(relationship(result, 'api-db')).toBeUndefined();
    });

    it('keeps the fields of the reverse relationship of a bidirectional edge', () => {
        const arch = fullArchitecture();
        const { 'unique-id': _id, 'relationship-type': _type, authentication: _auth, ...editedFields } = arch.relationships[0];
        arch.relationships.push({
            'unique-id': 'db-api',
            authentication: 'mTLS',
            'relationship-type': {
                connects: { source: { node: 'db', interfaces: ['db-sql'] }, destination: { node: 'api' } },
            },
            ...editedFields,
        });
        const { nodes, edges } = openCanvas(arch);
        expect(edges.find((e) => e.id === 'api-db')!.data.calmReverseRelId).toBe('db-api');

        const reverse = relationship(flowToCalm(nodes, edges), 'db-api');

        expect(reverse.authentication).toBe('mTLS');
        expect(reverse['relationship-type'].connects.source).toEqual({ node: 'db', interfaces: ['db-sql'] });
    });

    it('keeps the data of each relationship of an A→B and B→A pair that differ', () => {
        const arch = fullArchitecture();
        arch.relationships.push({
            'unique-id': 'db-api',
            description: 'Notifies the API',
            protocol: 'JDBC',
            'relationship-type': { connects: { source: { node: 'db' }, destination: { node: 'api' } } },
            controls: { retention: { description: 'Kept 7 days', requirements: [{ 'requirement-url': 'https://example.com/ret' }] } },
        });
        const original = JSON.parse(JSON.stringify(arch));
        const { nodes, edges } = openCanvas(arch);

        const result = flowToCalm(nodes, edges, original.controls);

        expect(JSON.stringify(withoutLayout(result), null, 2)).toBe(JSON.stringify(original, null, 2));
    });

    it('writes an edit of a bidirectional edge to both relationships', () => {
        const arch = fullArchitecture();
        const { 'unique-id': _id, 'relationship-type': _type, authentication: _auth, ...editedFields } = arch.relationships[0];
        arch.relationships.push({
            'unique-id': 'db-api',
            'relationship-type': { connects: { source: { node: 'db' }, destination: { node: 'api' } } },
            ...editedFields,
        });
        const { nodes, edges } = openCanvas(arch);
        const controls = { audit: { description: 'Edited', requirements: [{ 'requirement-url': 'https://example.com/audit' }] } };
        const apiDb = edges.find((e) => e.id === 'api-db')!;
        apiDb.data = { ...apiDb.data, controls };

        const result = flowToCalm(nodes, edges);

        expect(relationship(result, 'api-db').controls).toEqual(controls);
        expect(relationship(result, 'db-api').controls).toEqual(controls);
    });

    it('keeps the containment fields when a child moves out', () => {
        const { nodes, edges } = openCanvas(fullArchitecture());
        const db = nodes.find((n) => n.id === 'db')!;
        delete db.parentId;

        const rel = relationship(flowToCalm(nodes, edges), 'cluster-contents');

        expect(rel.description).toBe('Services run in the cluster');
        expect(rel.metadata).toEqual({ zone: 'a' });
        expect(rel['relationship-type']).toEqual({ 'deployed-in': { container: 'cluster', nodes: ['api'] } });
    });
});
