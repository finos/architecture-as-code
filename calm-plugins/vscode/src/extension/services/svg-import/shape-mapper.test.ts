import { describe, it, expect } from 'vitest';
import { mapShapeToNodeType } from './shape-mapper';

describe('mapShapeToNodeType', () => {
    describe('shape-based mapping', () => {
        it('maps cylinder to database', () => {
            expect(mapShapeToNodeType('cylinder', 'Orders')).toBe('database');
        });

        it('maps person to actor', () => {
            expect(mapShapeToNodeType('person', 'Admin')).toBe('actor');
        });

        it('maps cloud to ecosystem', () => {
            expect(mapShapeToNodeType('cloud', 'AWS')).toBe('ecosystem');
        });

        it('maps rounded-rectangle to service', () => {
            expect(mapShapeToNodeType('rounded-rectangle', 'Auth')).toBe('service');
        });

        it('maps rectangle to system', () => {
            expect(mapShapeToNodeType('rectangle', 'Backend')).toBe('system');
        });

        it('maps unknown to system', () => {
            expect(mapShapeToNodeType('unknown', 'Thing')).toBe('system');
        });

        it('maps document to data-asset', () => {
            expect(mapShapeToNodeType('document', 'Report')).toBe('data-asset');
        });
    });

    describe('label-based overrides', () => {
        it('overrides shape for database keywords', () => {
            expect(mapShapeToNodeType('rectangle', 'PostgreSQL Database')).toBe('database');
        });

        it('overrides shape for actor keywords', () => {
            expect(mapShapeToNodeType('rectangle', 'End User')).toBe('actor');
        });

        it('overrides shape for webclient keywords', () => {
            expect(mapShapeToNodeType('rectangle', 'Web App Frontend')).toBe('webclient');
        });

        it('overrides shape for network keywords', () => {
            expect(mapShapeToNodeType('rectangle', 'Private VPC')).toBe('network');
        });

        it('overrides shape for ldap keywords', () => {
            expect(mapShapeToNodeType('rectangle', 'Active Directory')).toBe('ldap');
        });

        it('overrides shape for ecosystem keywords', () => {
            expect(mapShapeToNodeType('rectangle', 'Third Party API')).toBe('ecosystem');
        });

        it('does not override when no keyword matches', () => {
            expect(mapShapeToNodeType('cylinder', 'Cache Layer')).toBe('database');
        });
    });
});
