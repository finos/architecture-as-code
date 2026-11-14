import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { C4ArchitectureInput } from '@finos/calm-models/c4';
import type { C4MappingService, NamespaceC4Mapping } from '../../../../service/c4-mapping-service.js';
import type { CalmService } from '../../../../service/calm-service.js';
import { C4Tab } from './C4Tab.js';

const node = (id: string, type: string, name = id, detail?: string) => ({
    'unique-id': id,
    'node-type': type,
    name,
    description: `${name} description`,
    ...(detail ? { details: { 'detailed-architecture': detail } } : {}),
});

const shop: C4ArchitectureInput = {
    title: 'Shop',
    nodes: [
        node('buyer', 'actor', 'Buyer'),
        node('shop', 'system', 'Shop System'),
        node('web', 'webclient', 'Web'),
        node('orders', 'service', 'Orders', '/calm/namespaces/shop/architectures/orders/versions/1.0.0'),
        node('worker', 'acme:worker', 'Worker'),
    ],
    relationships: [
        { 'unique-id': 'c', 'relationship-type': { 'composed-of': { container: 'shop', nodes: ['web', 'orders', 'worker'] } } },
        { 'unique-id': 'i', description: 'Browses the shop. Then buys.', 'relationship-type': { interacts: { actor: 'buyer', nodes: ['web'] } } },
        {
            'unique-id': 'w',
            description: 'Places orders',
            protocol: 'HTTPS',
            'relationship-type': { connects: { source: { node: 'web' }, destination: { node: 'orders' } } },
        },
    ],
};

const ordersDetail: C4ArchitectureInput = {
    nodes: [node('api', 'service', 'Orders API'), node('db', 'database', 'Orders DB')],
    relationships: [{ 'unique-id': 'r', 'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'db' } } } }],
};

function serviceReturning(detail?: C4ArchitectureInput) {
    const load = async () =>
        detail ? { id: 'orders', version: '1.0.0', name: 'shop', calmType: 'Architectures' as const, data: detail } : Promise.reject(new Error('gone'));
    const fetchArchitecture = vi.fn(load);
    const fetchResourceByCustomId = vi.fn(load);
    return { service: { fetchArchitecture, fetchResourceByCustomId } as unknown as CalmService, fetchArchitecture, fetchResourceByCustomId };
}

function mappingServiceReturning(found?: NamespaceC4Mapping | Error) {
    return {
        fetchDefaultMapping: vi.fn(async () => (found instanceof Error ? Promise.reject(found) : found)),
        fetchMappingAt: vi.fn(),
    } as unknown as C4MappingService;
}

function renderTab(params: Record<string, string> = {}, detail?: C4ArchitectureInput, architecture = shop, mappingService = mappingServiceReturning()) {
    const setTabParams = vi.fn();
    const { service, fetchArchitecture, fetchResourceByCustomId } = serviceReturning(detail);
    render(
        <div style={{ width: 1200, height: 800 }}>
            <C4Tab
                architecture={architecture}
                namespace="shop"
                searchParams={new URLSearchParams(params)}
                setTabParams={setTabParams}
                service={service}
                mappingService={mappingService}
            />
        </div>,
    );
    return { setTabParams, fetchArchitecture, fetchResourceByCustomId };
}

describe('C4Tab', () => {
    it('shows the context diagram of the first system', async () => {
        renderTab();

        expect(await screen.findByTestId('c4-element-shop')).toHaveTextContent('[Software System: system]');
        expect(screen.getByTestId('c4-element-buyer')).toHaveTextContent('Buyer');
        expect(screen.queryByTestId('c4-element-web')).not.toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Context' })).toHaveAttribute('aria-checked', 'true');
    });

    it('counts and marks the elements whose type no mapping names', async () => {
        renderTab({ level: 'container', scope: 'shop' });

        expect(await screen.findByText('1 guessed from structure')).toBeInTheDocument();
        expect(within(screen.getByTestId('c4-element-worker')).getByText('guessed')).toBeInTheDocument();
        expect(screen.getByText('calm-default-c4-mapping')).toBeInTheDocument();
    });

    it('uses the mapping that the namespace inherits', async () => {
        const mappingService = mappingServiceReturning({
            namespace: 'org',
            configId: 3,
            version: '1.1.0',
            inherited: true,
            config: {
                'unique-id': 'acme-c4-mapping',
                extends: 'https://calm.finos.org/standards/c4/1.0/calm-default.c4-mapping.json',
                'node-types': { 'acme:worker': 'container' },
            },
        });

        renderTab({ level: 'container', scope: 'shop' }, undefined, shop, mappingService);

        expect(await screen.findByText('Every element mapped')).toBeInTheDocument();
        expect(screen.getByText('acme-c4-mapping')).toHaveAttribute('title', 'The C4 mapping inherited from config 3 version 1.1.0 of namespace org');
        expect(mappingService.fetchDefaultMapping).toHaveBeenCalledWith('shop');
    });

    it('uses the default mapping and says why when the namespace mapping does not load', async () => {
        renderTab({ level: 'container', scope: 'shop' }, undefined, shop, mappingServiceReturning(new Error('Error fetching the C4 mapping of namespace shop:')));

        expect(await screen.findByRole('alert')).toHaveTextContent('The diagram uses the default C4 mapping.');
        expect(screen.getByText('calm-default-c4-mapping')).toBeInTheDocument();
        expect(screen.getByTestId('c4-element-worker')).toBeInTheDocument();
    });

    it('uses the default mapping when the namespace mapping is not a valid mapping', async () => {
        const invalid = { namespace: 'shop', configId: 1, version: '1.0.0', inherited: false, config: { 'node-types': {} } };

        renderTab({}, undefined, shop, mappingServiceReturning(invalid));

        expect(await screen.findByRole('alert')).toHaveTextContent('The C4 mapping is not a valid C4 mapping: "unique-id" must be a non-empty string');
    });

    it('shows the containers of a system inside its boundary', async () => {
        renderTab({ level: 'container', scope: 'shop' });

        expect(await screen.findByTestId('c4-element-orders')).toHaveTextContent('[Container: service]');
        expect(screen.getByTestId('c4-boundary')).toHaveTextContent('Shop System');
    });

    it('changes level through the level selector and starts the new level at its first scope', async () => {
        const { setTabParams } = renderTab({ level: 'container', scope: 'shop' });

        await userEvent.click(await screen.findByRole('radio', { name: 'Deployment' }));
        expect(setTabParams).toHaveBeenLastCalledWith({ level: 'deployment' });

        await userEvent.click(screen.getByRole('radio', { name: 'Context' }));
        expect(setTabParams).toHaveBeenLastCalledWith({});
    });

    it('opens the next level when an element with something inside it is clicked', async () => {
        const { setTabParams } = renderTab();

        fireEvent.click(await screen.findByTestId('c4-element-shop'));

        expect(setTabParams).toHaveBeenCalledWith({ level: 'container', scope: 'shop' });
    });

    it('zooms through a CALM Hub detailed architecture and shows a breadcrumb back to the system', async () => {
        const { setTabParams, fetchResourceByCustomId } = renderTab({ level: 'component', scope: 'orders' }, ordersDetail);

        expect(await screen.findByTestId('c4-element-orders/api')).toHaveTextContent('[Component: service]');
        expect(fetchResourceByCustomId).toHaveBeenCalledWith('shop', 'orders', '1.0.0', 'Architectures');
        const breadcrumb = screen.getByRole('navigation', { name: 'C4 scope' });
        expect(within(breadcrumb).getByText('Orders')).toHaveAttribute('aria-current', 'page');

        await userEvent.click(within(breadcrumb).getByRole('button', { name: 'Shop System' }));
        expect(setTabParams).toHaveBeenCalledWith({ level: 'container', scope: 'shop' });
    });

    it('reads a detailed architecture with a numeric id through the numeric API', async () => {
        const numeric = { ...shop, nodes: shop.nodes!.map((n) => (n['unique-id'] === 'orders' ? node('orders', 'service', 'Orders', '/calm/namespaces/shop/architectures/12/versions/1.0.0') : n)) };

        const { fetchArchitecture } = renderTab({ level: 'component', scope: 'orders' }, ordersDetail, numeric);

        expect(await screen.findByTestId('c4-element-orders/api')).toBeInTheDocument();
        expect(fetchArchitecture).toHaveBeenCalledWith('shop', '12', '1.0.0');
    });

    it('says when a level has nothing to show, also when a detailed architecture does not load', async () => {
        renderTab({ level: 'component' });

        expect(await screen.findByText('No component diagram: nothing in this architecture is at this level.')).toBeInTheDocument();
    });

    it('lists conflicts and the notes on demoted elements', async () => {
        renderTab({}, undefined, {
            nodes: [node('sys', 'system', 'Sys'), node('inner', 'system', 'Inner'), node('clerk', 'actor', 'Clerk')],
            relationships: [{ 'unique-id': 'c', 'relationship-type': { 'composed-of': { container: 'sys', nodes: ['inner', 'clerk'] } } }],
        });

        const notes = await screen.findByTestId('c4-notes');
        expect(within(notes).getByText('1 conflict, 1 note')).toBeInTheDocument();
        expect(notes).toHaveTextContent('Clerk: A person inside software-system "Sys"');
        expect(notes).toHaveTextContent('Inner: Mapped as software-system, shown as container');
    });

    it('asks for an architecture', () => {
        render(
            <C4Tab
                architecture={undefined}
                namespace="shop"
                searchParams={new URLSearchParams()}
                setTabParams={vi.fn()}
                mappingService={mappingServiceReturning()}
            />,
        );

        expect(screen.getByText('This tab shows architectures only.')).toBeInTheDocument();
    });

    it('hides the zoom controls on mobile', async () => {
        const matchMedia = window.matchMedia;
        window.matchMedia = ((query: string) => ({ ...matchMedia(query), matches: query.includes('max-width') })) as typeof window.matchMedia;
        try {
            renderTab();
            await screen.findByTestId('c4-element-shop');
            expect(document.querySelector('.react-flow__controls')).not.toBeInTheDocument();
        } finally {
            window.matchMedia = matchMedia;
        }
    });

    it('shows the zoom controls on desktop', async () => {
        renderTab();
        await screen.findByTestId('c4-element-shop');
        await waitFor(() => expect(document.querySelector('.react-flow__controls')).toBeInTheDocument());
    });
});
