import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NamespaceConfigs } from './NamespaceConfigs.js';
import { ConfigService } from '../../../service/config-service.js';
import { ConfigSummary, NamespaceDefaultConfig } from '../../../model/config.js';

function serviceWith(
    configs: Record<string, ConfigSummary[] | Error>,
    defaults: Record<string, NamespaceDefaultConfig | undefined>
): ConfigService {
    return {
        fetchConfigTypes: vi.fn().mockResolvedValue(Object.keys(configs).map((type) => ({ type, schema: `${type}.json` }))),
        fetchConfigs: vi.fn((_ns: string, type: string) => {
            const value = configs[type];
            return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
        }),
        fetchNamespaceDefault: vi.fn((_ns: string, type: string) => Promise.resolve(defaults[type])),
    } as unknown as ConfigService;
}

const acme: ConfigSummary = { id: 3, name: 'acme-c4', description: 'Acme mapping', versionCount: 2 };
const other: ConfigSummary = { id: 4, name: 'draft-c4', versionCount: 1 };

describe('NamespaceConfigs', () => {
    it('lists the configs of a type and marks the one the namespace sets as its default', async () => {
        const service = serviceWith(
            { 'c4-mapping': [acme, other] },
            { 'c4-mapping': { configType: 'c4-mapping', namespace: 'org', configId: 3, version: '1.1.0', inherited: false, config: {} } }
        );
        render(<NamespaceConfigs namespace="org" service={service} />);

        const group = await screen.findByTestId('config-group-c4-mapping');
        expect(within(group).getByText('Default: config 3, version 1.1.0')).toBeInTheDocument();
        const rows = within(group).getAllByRole('listitem');
        expect(rows[0]).toHaveTextContent('acme-c4');
        expect(rows[0]).toHaveTextContent('default');
        expect(rows[0]).toHaveTextContent('#3 · 2 versions');
        expect(rows[1]).toHaveTextContent('draft-c4');
        expect(rows[1]).not.toHaveTextContent('default');
        expect(rows[1]).toHaveTextContent('1 version');
    });

    it('shows an inherited default without marking a local config with the same id', async () => {
        const service = serviceWith(
            { 'c4-mapping': [acme] },
            { 'c4-mapping': { configType: 'c4-mapping', namespace: 'org', configId: 3, version: '1.0.0', inherited: true, config: {} } }
        );
        render(<NamespaceConfigs namespace="org.team" service={service} />);

        const group = await screen.findByTestId('config-group-c4-mapping');
        expect(group).toHaveTextContent('Default inherited from org: config 3, version 1.0.0');
        expect(within(group).getByRole('listitem')).not.toHaveTextContent('default');
    });

    it('shows a type that has only an inherited default, and leaves out a type that failed', async () => {
        const service = serviceWith(
            { 'c4-mapping': [], theme: new Error('down') },
            { 'c4-mapping': { configType: 'c4-mapping', namespace: 'org', configId: 1, version: '1.0.0', inherited: true, config: {} } }
        );
        render(<NamespaceConfigs namespace="org.team" service={service} />);

        const group = await screen.findByTestId('config-group-c4-mapping');
        expect(within(group).queryByRole('list')).not.toBeInTheDocument();
        expect(screen.queryByTestId('config-group-theme')).not.toBeInTheDocument();
    });

    it('renders nothing when no type has a config or a default', async () => {
        const service = serviceWith({ 'c4-mapping': [] }, { 'c4-mapping': undefined });
        const { container } = render(<NamespaceConfigs namespace="org" service={service} />);

        await vi.waitFor(() => expect(service.fetchNamespaceDefault).toHaveBeenCalled());
        await Promise.resolve();
        expect(container).toBeEmptyDOMElement();
    });
});
