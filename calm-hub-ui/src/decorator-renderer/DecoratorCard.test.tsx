import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DecoratorCard, type RenderableDecorator } from './DecoratorCard.js';

const decorator: RenderableDecorator = {
    uniqueId: 'obs-1',
    type: 'observability',
    schema: 'https://calm.finos.org/standards/observability.decorator.schema.json',
    target: ['/api/calm/namespaces/finos/architectures/1/versions/1-0-0'],
    appliesTo: ['api-service', 'db'],
    data: { dashboard: 'https://grafana.example.com/d/abc' },
};

describe('DecoratorCard', () => {
    it('shows the type, unique id and applies-to', () => {
        render(<DecoratorCard decorator={decorator} />);
        expect(screen.getByRole('article', { name: 'observability decorator obs-1' })).toBeInTheDocument();
        expect(screen.getByText('observability')).toBeInTheDocument();
        expect(screen.getByText('obs-1')).toBeInTheDocument();
        expect(screen.getByText('api-service')).toBeInTheDocument();
        expect(screen.getByText('db')).toBeInTheDocument();
    });

    it('links an http(s) schema', () => {
        render(<DecoratorCard decorator={decorator} />);
        expect(screen.getByRole('link', { name: decorator.schema })).toHaveAttribute('href', decorator.schema);
    });

    it('shows a schema that is not a web URL as text', () => {
        render(<DecoratorCard decorator={{ ...decorator, schema: 'urn:example:schema' }} />);
        expect(screen.getByText(/urn:example:schema/)).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'urn:example:schema' })).not.toBeInTheDocument();
    });

    it('renders the data by shape, and switches to raw JSON and back', async () => {
        const user = userEvent.setup();
        render(<DecoratorCard decorator={decorator} />);
        expect(screen.getByRole('link', { name: 'https://grafana.example.com/d/abc' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Data' })).toHaveAttribute('aria-pressed', 'true');

        await user.click(screen.getByRole('button', { name: 'JSON' }));
        expect(screen.getByRole('button', { name: 'JSON' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('link', { name: 'https://grafana.example.com/d/abc' })).not.toBeInTheDocument();
        expect(screen.getByText(/"unique-id": "obs-1"/)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Data' }));
        expect(screen.getByRole('link', { name: 'https://grafana.example.com/d/abc' })).toBeInTheDocument();
    });

    it('shows the JSON that a write takes, without the Hub-owned times, which show apart from it', async () => {
        const user = userEvent.setup();
        render(<DecoratorCard decorator={{ ...decorator, creationDateTime: '2026-11-01T10:00:00Z', updateDateTime: '2026-11-02T10:00:00Z' }} />);
        await user.click(screen.getByRole('button', { name: 'JSON' }));

        const json = JSON.parse(document.querySelector('pre')!.textContent!);
        expect(json).toEqual({
            $schema: decorator.schema,
            'unique-id': 'obs-1',
            type: 'observability',
            target: decorator.target,
            'applies-to': ['api-service', 'db'],
            data: decorator.data,
        });
        expect(screen.getByText('Created')).toBeInTheDocument();
        expect(screen.getByText('Updated')).toBeInTheDocument();
    });

    it('tolerates a decorator with no schema and no applies-to', () => {
        render(<DecoratorCard decorator={{ uniqueId: 'x', type: 'custom', data: null }} />);
        expect(screen.queryByText(/Schema:/)).not.toBeInTheDocument();
        expect(screen.queryByText('Applies to')).not.toBeInTheDocument();
        expect(screen.getByText('null')).toBeInTheDocument();
    });

    it('labels a decorator with no type, and copes with missing fields', () => {
        render(<DecoratorCard decorator={{ data: { note: 'no type' } }} />);
        expect(screen.getByRole('article', { name: '(no type) decorator' })).toBeInTheDocument();
        expect(screen.getByText('(no type)')).toBeInTheDocument();
        expect(screen.getByText('no type')).toBeInTheDocument();
    });

    it('shows the timestamps when they are present', () => {
        render(<DecoratorCard decorator={{ ...decorator, creationDateTime: '2026-03-01T10:15:00Z', updateDateTime: '2026-03-02T08:00:00Z' }} />);
        expect(screen.getByText('Created')).toBeInTheDocument();
        expect(screen.getByText('Updated')).toBeInTheDocument();
        const times = screen.getAllByRole('time');
        expect(times.map((time) => time.getAttribute('datetime'))).toEqual(['2026-03-01T10:15:00Z', '2026-03-02T08:00:00Z']);
    });

    it('shows only the timestamp that is present', () => {
        render(<DecoratorCard decorator={{ ...decorator, updateDateTime: '2026-03-02T08:00:00Z' }} />);
        expect(screen.queryByText('Created')).not.toBeInTheDocument();
        expect(screen.getByText('Updated')).toBeInTheDocument();
    });

    it('shows no timestamps when they are absent', () => {
        render(<DecoratorCard decorator={decorator} />);
        expect(screen.queryByText('Created')).not.toBeInTheDocument();
        expect(screen.queryByText('Updated')).not.toBeInTheDocument();
        expect(screen.queryByRole('time')).not.toBeInTheDocument();
    });
});
