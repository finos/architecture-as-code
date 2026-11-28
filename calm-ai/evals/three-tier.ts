import { expect } from 'vitest';

export const filename = 'three-tier.architecture.json';

export const prompt = `Create ${filename} as a CALM 1.3 architecture.
Include exactly three nodes: a web frontend (frontend), a backend API (api), and a database (database).
Include exactly two relationships: the frontend connects to the API over HTTPS, and the API connects to the database over JDBC.
Model the database listener on port 5432 as an interface and reference it from the JDBC connection.
Validate the file using calm validate and fix any issues.`;

interface Architecture {
    $schema: string;
    nodes: {
        'unique-id': string;
        'node-type': string;
        interfaces?: { 'unique-id': string; port?: number }[];
    }[];
    relationships: {
        protocol?: string;
        'relationship-type': {
            connects?: { source: { node: string }; destination: { node: string; interfaces?: string[] } };
        };
    }[];
}

// The CALM CLI validates the document shape before this scorer runs.
export function assertThreeTier(architecture: Architecture): void {
    expect(architecture.$schema).toBe('https://calm.finos.org/release/1.3/meta/calm.json');
    expect(architecture.nodes.map(node => [node['unique-id'], node['node-type']]).sort()).toEqual([
        ['api', 'service'],
        ['database', 'database'],
        ['frontend', 'webclient'],
    ]);

    const connections = architecture.relationships.map(relationship => ({
        protocol: relationship.protocol,
        connects: relationship['relationship-type'].connects,
    }));
    expect(connections).toHaveLength(2);
    expect(connections.map(({ protocol, connects }) => [
        protocol, connects?.source.node, connects?.destination.node,
    ]).sort()).toEqual([
        ['HTTPS', 'frontend', 'api'],
        ['JDBC', 'api', 'database'],
    ]);

    const database = architecture.nodes.find(node => node['unique-id'] === 'database');
    const referencedInterfaces = connections.find(connection => connection.protocol === 'JDBC')
        ?.connects?.destination.interfaces;
    expect(database?.interfaces?.some(endpoint =>
        endpoint.port === 5432 && referencedInterfaces?.includes(endpoint['unique-id'])
    ), 'JDBC must reference a database interface on port 5432').toBe(true);
}
