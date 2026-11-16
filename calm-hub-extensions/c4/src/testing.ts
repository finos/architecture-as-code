// Test data: a small shop architecture, in the shape that CALM Hub returns.
import type { C4ArchitectureInput } from '@finos/calm-models/c4';

type Relationship = NonNullable<C4ArchitectureInput['relationships']>[number];

export const calmNode = (id: string, type: string, extra: object = {}) => ({ 'unique-id': id, 'node-type': type, name: id, description: `The ${id}.`, ...extra });
const composed = (container: string, ...nodes: string[]): Relationship => ({
    'unique-id': `${container}-composed-of`,
    'relationship-type': { 'composed-of': { container, nodes } },
});
export const connects = (source: string, target: string, description?: string, protocol?: string): Relationship => ({
    'unique-id': `${source}-${target}`,
    description,
    protocol,
    'relationship-type': { connects: { source: { node: source }, destination: { node: target } } },
});
const deployed = (container: string, ...nodes: string[]): Relationship => ({
    'unique-id': `${container}-deployed-in`,
    'relationship-type': { 'deployed-in': { container, nodes } },
});

export const SHOP: C4ArchitectureInput = {
    title: 'Shop',
    nodes: [
        calmNode('customer', 'actor'),
        calmNode('shop', 'system'),
        calmNode('web', 'webclient'),
        calmNode('api', 'service'),
        calmNode('db', 'database'),
        calmNode('mailer', 'x:mailer'),
        calmNode('payments', 'system'),
        calmNode('cluster', 'network'),
    ],
    relationships: [
        composed('shop', 'web', 'api', 'db', 'mailer'),
        connects('customer', 'web', 'Places orders', 'HTTPS'),
        connects('web', 'api', 'Calls', 'HTTPS'),
        connects('api', 'db', 'Reads and writes', 'JDBC'),
        connects('api', 'mailer', 'Sends e-mail using'),
        connects('api', 'payments', 'Takes payment', 'HTTPS'),
        deployed('cluster', 'api', 'db'),
    ],
};
