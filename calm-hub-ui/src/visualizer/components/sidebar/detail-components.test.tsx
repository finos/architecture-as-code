import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
    Section, Badge, RiskLevelBadge,
    PropertiesSection, ControlsSection, RisksSection, MitigationsSection,
    InterfacesSection, ConnectionDiagram, NodeList,
} from './detail-components.js';
import { Box } from 'lucide-react';

describe('Section', () => {
    it('renders title and children', () => {
        render(<Section title="Test Section"><p>Content</p></Section>);

        expect(screen.getByText('Test Section')).toBeInTheDocument();
        expect(screen.getByText('Content')).toBeInTheDocument();
    });
});

describe('Badge', () => {
    it('renders label with background color', () => {
        render(<Badge icon={Box} label="system" color="#3b82f6" />);

        const badge = screen.getByText('system');
        expect(badge.closest('span')).toHaveStyle({ backgroundColor: '#3b82f6' });
    });
});

describe('RiskLevelBadge', () => {
    it('renders risk level text', () => {
        render(<RiskLevelBadge level="high" />);
        expect(screen.getByText('high')).toBeInTheDocument();
    });
});

describe('PropertiesSection', () => {
    it('returns null for empty properties', () => {
        const { container } = render(<PropertiesSection properties={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders property keys and values', () => {
        render(<PropertiesSection properties={[['my-field', 'my-value']]} />);

        expect(screen.getByText('My Field')).toBeInTheDocument();
        expect(screen.getByText('my-value')).toBeInTheDocument();
    });

    it('renders nested object values as pretty-printed JSON, not [object Object]', () => {
        render(
            <PropertiesSection properties={[['config', { retries: 3, egg: 'beans' }]]} />
        );

        expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
        expect(screen.getByText(/"egg": "beans"/)).toBeInTheDocument();
    });

    it('renders array values as JSON, not [object Object]', () => {
        render(
            <PropertiesSection properties={[['tags', ['alpha', 'beta']]]} />
        );

        expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
        expect(screen.getByText(/"alpha"/)).toBeInTheDocument();
    });

    it('renders null values as the string null', () => {
        render(<PropertiesSection properties={[['optional', null]]} />);
        expect(screen.getByText('null')).toBeInTheDocument();
    });
});

describe('ControlsSection', () => {
    it('returns null for empty controls', () => {
        const { container } = render(<ControlsSection controls={{}} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders control id and description', () => {
        render(
            <ControlsSection controls={{
                'auth-check': { description: 'Verify auth tokens' },
            }} />
        );

        expect(screen.getByText('auth-check')).toBeInTheDocument();
        expect(screen.getByText('Verify auth tokens')).toBeInTheDocument();
    });

    it('renders requirement count', () => {
        render(
            <ControlsSection controls={{
                ctrl: { requirements: [{ url: 'a' }, { url: 'b' }] },
            }} />
        );

        expect(screen.getByText('2 requirements')).toBeInTheDocument();
    });

    it('renders singular requirement text for one requirement', () => {
        render(
            <ControlsSection controls={{
                ctrl: { requirements: [{ url: 'a' }] },
            }} />
        );

        expect(screen.getByText('1 requirement')).toBeInTheDocument();
    });
});

describe('RisksSection', () => {
    it('returns null for empty risks', () => {
        const { container } = render(<RisksSection risks={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders string risks', () => {
        render(<RisksSection risks={['Data leak']} />);
        expect(screen.getByText('Data leak')).toBeInTheDocument();
    });

    it('renders object risks using name', () => {
        render(<RisksSection risks={[{ name: 'SQL Injection' }]} />);
        expect(screen.getByText('SQL Injection')).toBeInTheDocument();
    });

    it('falls back to id then JSON for object risks', () => {
        render(<RisksSection risks={[{ id: 'risk-id' }]} />);
        expect(screen.getByText('risk-id')).toBeInTheDocument();
    });
});

describe('MitigationsSection', () => {
    it('returns null for empty mitigations', () => {
        const { container } = render(<MitigationsSection mitigations={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders string mitigations', () => {
        render(<MitigationsSection mitigations={['Use encryption']} />);
        expect(screen.getByText('Use encryption')).toBeInTheDocument();
    });

    it('renders object mitigations using name', () => {
        render(<MitigationsSection mitigations={[{ name: 'WAF' }]} />);
        expect(screen.getByText('WAF')).toBeInTheDocument();
    });
});

describe('InterfacesSection', () => {
    it('returns null for empty interfaces', () => {
        const { container } = render(<InterfacesSection interfaces={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders interface id and fields', () => {
        render(
            <InterfacesSection interfaces={[
                { 'unique-id': 'iface-1', host: 'localhost', port: 443 },
            ]} />
        );

        expect(screen.getByText('iface-1')).toBeInTheDocument();
        expect(screen.getByText('localhost')).toBeInTheDocument();
        expect(screen.getByText('443')).toBeInTheDocument();
    });

    it('generates fallback id when unique-id is missing', () => {
        render(<InterfacesSection interfaces={[{ host: 'example.com' }]} />);
        expect(screen.getByText('interface-0')).toBeInTheDocument();
    });

    it('renders nested object interface field as pretty-printed JSON, not [object Object]', () => {
        // Reproduces issue #2745: rate-limit interface with a properties object
        render(
            <InterfacesSection interfaces={[
                { 'unique-id': 'rate-limit', properties: { key: 'IP', calls: 100, egg: 'beans' } },
            ]} />
        );

        expect(screen.getByText('rate-limit')).toBeInTheDocument();
        expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
        expect(screen.getByText(/"egg": "beans"/)).toBeInTheDocument();
    });
});

describe('ConnectionDiagram', () => {
    it('renders source and destination nodes', () => {
        render(<ConnectionDiagram nodes={['node-a', 'node-b']} />);

        expect(screen.getByText('node-a')).toBeInTheDocument();
        expect(screen.getByText('node-b')).toBeInTheDocument();
    });
});

describe('NodeList', () => {
    it('renders label and all nodes', () => {
        render(<NodeList label="Connected" nodes={['n1', 'n2', 'n3']} />);

        expect(screen.getByText('Connected')).toBeInTheDocument();
        expect(screen.getByText('n1')).toBeInTheDocument();
        expect(screen.getByText('n2')).toBeInTheDocument();
        expect(screen.getByText('n3')).toBeInTheDocument();
    });
});
