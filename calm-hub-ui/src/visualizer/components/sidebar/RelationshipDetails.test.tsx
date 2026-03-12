import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RelationshipDetails } from './RelationshipDetails.js';
import { CalmRelationshipSchema } from '@finos/calm-models/types';

const connectsRelationship: CalmRelationshipSchema = {
    'unique-id': 'rel-001',
    description: 'Service to DB',
    'relationship-type': {
        connects: {
            source: { node: 'service-1' },
            destination: { node: 'db-1' },
        },
    },
};

describe('RelationshipDetails', () => {
    it('renders unique-id and description', () => {
        render(<RelationshipDetails data={connectsRelationship} />);

        expect(screen.getByText('rel-001')).toBeInTheDocument();
        expect(screen.getByText('Service to DB')).toBeInTheDocument();
    });

    it('renders connects type badge and connection diagram', () => {
        render(<RelationshipDetails data={connectsRelationship} />);

        expect(screen.getByText('connects')).toBeInTheDocument();
        expect(screen.getByText('Connection')).toBeInTheDocument();
        expect(screen.getByText('service-1')).toBeInTheDocument();
        expect(screen.getByText('db-1')).toBeInTheDocument();
    });

    it('renders protocol badge when present', () => {
        const withProtocol: CalmRelationshipSchema = {
            ...connectsRelationship,
            protocol: 'HTTPS',
        };
        render(<RelationshipDetails data={withProtocol} />);

        expect(screen.getByText('HTTPS')).toBeInTheDocument();
    });

    it('renders interacts relationship type', () => {
        const interactsRel: CalmRelationshipSchema = {
            'unique-id': 'rel-002',
            'relationship-type': {
                interacts: {
                    actor: 'user-1',
                    nodes: ['service-1', 'service-2'],
                },
            },
        };
        render(<RelationshipDetails data={interactsRel} />);

        expect(screen.getByText('interacts')).toBeInTheDocument();
        expect(screen.getByText('Interaction')).toBeInTheDocument();
        expect(screen.getByText('user-1')).toBeInTheDocument();
        expect(screen.getByText('service-1')).toBeInTheDocument();
        expect(screen.getByText('service-2')).toBeInTheDocument();
    });

    it('renders deployed-in relationship type', () => {
        const deployedInRel: CalmRelationshipSchema = {
            'unique-id': 'rel-003',
            'relationship-type': {
                'deployed-in': {
                    container: 'k8s-cluster',
                    nodes: ['svc-a', 'svc-b'],
                },
            },
        };
        render(<RelationshipDetails data={deployedInRel} />);

        expect(screen.getByText('deployed-in')).toBeInTheDocument();
        expect(screen.getByText('Deployment')).toBeInTheDocument();
        expect(screen.getByText('k8s-cluster')).toBeInTheDocument();
        expect(screen.getByText('svc-a')).toBeInTheDocument();
    });

    it('renders composed-of relationship type', () => {
        const composedOfRel: CalmRelationshipSchema = {
            'unique-id': 'rel-004',
            'relationship-type': {
                'composed-of': {
                    container: 'api-gateway',
                    nodes: ['router', 'auth'],
                },
            },
        };
        render(<RelationshipDetails data={composedOfRel} />);

        expect(screen.getByText('composed-of')).toBeInTheDocument();
        expect(screen.getByText('Composition')).toBeInTheDocument();
        expect(screen.getByText('api-gateway')).toBeInTheDocument();
        expect(screen.getByText('router')).toBeInTheDocument();
    });

    it('renders risk level and risks from aigf metadata', () => {
        const withRisks: CalmRelationshipSchema = {
            ...connectsRelationship,
            metadata: {
                aigf: {
                    'risk-level': 'medium',
                    risks: ['Latency risk'],
                },
            },
        };
        render(<RelationshipDetails data={withRisks} />);

        expect(screen.getByText('medium')).toBeInTheDocument();
        expect(screen.getByText('Risks')).toBeInTheDocument();
        expect(screen.getByText('Latency risk')).toBeInTheDocument();
    });

    it('renders controls when present', () => {
        const withControls: CalmRelationshipSchema = {
            ...connectsRelationship,
            controls: {
                'tls-required': { description: 'TLS must be enabled' },
            },
        };
        render(<RelationshipDetails data={withControls} />);

        expect(screen.getByText('Controls')).toBeInTheDocument();
        expect(screen.getByText('tls-required')).toBeInTheDocument();
        expect(screen.getByText('TLS must be enabled')).toBeInTheDocument();
    });

    it('renders extra properties not in the known set', () => {
        const withExtra = {
            ...connectsRelationship,
            'custom-prop': 'custom-val',
        } as CalmRelationshipSchema;
        render(<RelationshipDetails data={withExtra} />);

        expect(screen.getByText('Properties')).toBeInTheDocument();
        expect(screen.getByText('Custom Prop')).toBeInTheDocument();
        expect(screen.getByText('custom-val')).toBeInTheDocument();
    });
});
