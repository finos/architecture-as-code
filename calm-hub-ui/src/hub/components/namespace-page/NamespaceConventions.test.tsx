import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NamespaceConventions } from './NamespaceConventions.js';
import { ConventionService } from '../../../service/convention-service.js';
import { ConventionSummary, NamespaceDefaultConvention } from '../../../model/convention.js';

function serviceWith(
    conventions: Record<string, ConventionSummary[] | Error>,
    defaults: Record<string, NamespaceDefaultConvention | undefined>,
    byNamespace: Record<string, Record<string, ConventionSummary[]>> = {}
): ConventionService {
    return {
        fetchConventionTypes: vi.fn().mockResolvedValue(Object.keys(conventions).map((type) => ({ type, schema: `${type}.json` }))),
        fetchConventions: vi.fn((ns: string, type: string) => {
            const value = byNamespace[ns]?.[type] ?? conventions[type];
            return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
        }),
        fetchNamespaceDefault: vi.fn((_ns: string, type: string) => Promise.resolve(defaults[type])),
    } as unknown as ConventionService;
}

const acme: ConventionSummary = { id: 3, name: 'acme-c4', description: 'Acme mapping', versionCount: 2 };
const other: ConventionSummary = { id: 4, name: 'draft-c4', versionCount: 1 };

describe('NamespaceConventions', () => {
    it('lists the conventions of a type and marks the one the namespace sets as its default', async () => {
        const service = serviceWith(
            { 'c4-mapping': [acme, other] },
            { 'c4-mapping': { conventionType: 'c4-mapping', namespace: 'org', conventionId: 3, version: '1.1.0', inherited: false, convention: {} } }
        );
        render(<NamespaceConventions namespace="org" service={service} />);

        const group = await screen.findByTestId('convention-group-c4-mapping');
        expect(within(group).getByText('Default: convention 3, version 1.1.0')).toBeInTheDocument();
        const rows = within(group).getAllByRole('listitem');
        expect(rows[0]).toHaveTextContent('acme-c4');
        expect(rows[0]).toHaveTextContent('default');
        expect(rows[0]).toHaveTextContent('#3 · 2 versions');
        expect(rows[1]).toHaveTextContent('draft-c4');
        expect(rows[1]).not.toHaveTextContent('default');
        expect(rows[1]).toHaveTextContent('1 version');
    });

    it('shows an inherited default without marking a local convention with the same id', async () => {
        const service = serviceWith(
            { 'c4-mapping': [acme] },
            { 'c4-mapping': { conventionType: 'c4-mapping', namespace: 'org', conventionId: 3, version: '1.0.0', inherited: true, convention: {} } }
        );
        render(<NamespaceConventions namespace="org.team" service={service} />);

        const group = await screen.findByTestId('convention-group-c4-mapping');
        expect(group).toHaveTextContent('Default inherited from org: convention 3, version 1.0.0');
        expect(within(group).getByRole('listitem')).not.toHaveTextContent('default');
    });

    it('shows a type that has only an inherited default, and leaves out a type that failed', async () => {
        const service = serviceWith(
            { 'c4-mapping': [], theme: new Error('down') },
            { 'c4-mapping': { conventionType: 'c4-mapping', namespace: 'org', conventionId: 1, version: '1.0.0', inherited: true, convention: {} } }
        );
        render(<NamespaceConventions namespace="org.team" service={service} />);

        const group = await screen.findByTestId('convention-group-c4-mapping');
        expect(within(group).queryByRole('list')).not.toBeInTheDocument();
        expect(screen.queryByTestId('convention-group-theme')).not.toBeInTheDocument();
    });

    it('hides the version count when Hub reports 0, as in GitHub mode', async () => {
        const service = serviceWith({ 'c4-mapping': [{ id: 7, name: 'acme-c4', versionCount: 0 }] }, {});
        render(<NamespaceConventions namespace="org" service={service} />);

        const row = within(await screen.findByTestId('convention-group-c4-mapping')).getByRole('listitem');
        expect(row).toHaveTextContent('#7');
        expect(row).not.toHaveTextContent('version');
    });

    // A second namespace, loaded through the same steps, shows when the empty one has loaded too.
    it('renders nothing when no type has a convention or a default', async () => {
        const service = serviceWith({ 'c4-mapping': [] }, { 'c4-mapping': undefined }, { org: { 'c4-mapping': [acme] } });
        render(
            <>
                <div data-testid="empty">
                    <NamespaceConventions namespace="org.empty" service={service} />
                </div>
                <NamespaceConventions namespace="org" service={service} />
            </>
        );

        await screen.findByTestId('convention-group-c4-mapping');
        expect(screen.getByTestId('empty')).toBeEmptyDOMElement();
    });

    it('renders nothing when the convention types request fails', async () => {
        const failing = serviceWith({}, {});
        vi.mocked(failing.fetchConventionTypes).mockRejectedValue(new Error('down'));
        render(
            <>
                <div data-testid="failed">
                    <NamespaceConventions namespace="org" service={failing} />
                </div>
                <NamespaceConventions namespace="org" service={serviceWith({ 'c4-mapping': [acme] }, {})} />
            </>
        );

        await screen.findByTestId('convention-group-c4-mapping');
        expect(screen.getByTestId('failed')).toBeEmptyDOMElement();
        expect(failing.fetchConventions).not.toHaveBeenCalled();
    });
});
