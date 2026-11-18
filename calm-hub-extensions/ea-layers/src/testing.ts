// Test data: a small shop architecture, in the shape that CALM Hub returns.
import type { CalmArchitecture, CalmRelationship } from './lens.js';

export const calmNode = (id: string, type: string) => ({ 'unique-id': id, 'node-type': type, name: id, description: `The ${id}.` });
const composed = (container: string, ...nodes: string[]): CalmRelationship => ({
    'unique-id': `${container}-composed-of`,
    'relationship-type': { 'composed-of': { container, nodes } },
});
export const connects = (source: string, target: string, description?: string, protocol?: string): CalmRelationship => ({
    'unique-id': `${source}-${target}`,
    description,
    protocol,
    'relationship-type': { connects: { source: { node: source }, destination: { node: target } } },
});

export const SHOP: CalmArchitecture = {
    nodes: [
        calmNode('customer', 'actor'),
        calmNode('shop', 'system'),
        calmNode('web', 'webclient'),
        calmNode('api', 'service'),
        calmNode('orders', 'data-asset'),
        calmNode('db', 'database'),
        calmNode('directory', 'ldap'),
        calmNode('mailer', 'x:mailer'),
        calmNode('cluster', 'network'),
    ],
    relationships: [
        composed('shop', 'web', 'api', 'mailer', 'db'),
        { 'unique-id': 'customer-uses-web', 'relationship-type': { interacts: { actor: 'customer', nodes: ['web'] } } },
        connects('web', 'api', 'Calls', 'HTTPS'),
        connects('api', 'db', 'Reads and writes', 'JDBC'),
        connects('api', 'mailer', 'Sends e-mail using'),
        connects('api', 'directory', 'Checks staff in', 'LDAP'),
        connects('api', 'orders', 'Stores'),
        { 'unique-id': 'cluster-deployed-in', 'relationship-type': { 'deployed-in': { container: 'cluster', nodes: ['api', 'db'] } } },
    ],
};
