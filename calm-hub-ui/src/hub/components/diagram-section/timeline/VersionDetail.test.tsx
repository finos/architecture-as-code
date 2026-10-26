import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VersionDetail } from './VersionDetail.js';
import type { TimelineMoment } from './TimelineBar.js';
import type { VersionChange } from './perVersionChanges.js';

const moment: TimelineMoment = {
    key: 'm2',
    label: 'Release 2',
    version: '2.0.0',
    description: 'Adds the payments service',
    validFrom: '2026-01-01',
};

function deferred<T>() {
    let resolve: (value: T) => void = () => undefined;
    let reject: (reason: unknown) => void = () => undefined;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('VersionDetail', () => {
    it('renders the moment label, date and description', async () => {
        render(<VersionDetail moment={moment} loadChanges={() => Promise.resolve([])} />);
        expect(screen.getByText('Release 2')).toBeInTheDocument();
        expect(screen.getByText('2026-01-01')).toBeInTheDocument();
        expect(screen.getByText('Adds the payments service')).toBeInTheDocument();
        expect(await screen.findByText('No changes from the previous version.')).toBeInTheDocument();
    });

    it('shows a loading state, then the changes', async () => {
        const pending = deferred<VersionChange[]>();
        render(<VersionDetail moment={moment} loadChanges={() => pending.promise} />);
        expect(screen.getByTestId('timeline-changes-loading')).toBeInTheDocument();

        await act(async () => pending.resolve([{ kind: 'add', text: 'Added node payments' }]));
        expect(screen.getByTestId('timeline-changes-list')).toHaveTextContent('Added node payments');
    });

    it('shows an error when the changes cannot be loaded', async () => {
        render(<VersionDetail moment={moment} loadChanges={() => Promise.reject(new Error('boom'))} />);
        expect(await screen.findByText('Could not load changes for this version')).toBeInTheDocument();
    });

    it('shows the loading state again when the loader changes, and ignores the old result', async () => {
        const first = deferred<VersionChange[]>();
        const second = deferred<VersionChange[]>();
        const loadFirst = () => first.promise;
        const loadSecond = () => second.promise;

        const { rerender } = render(<VersionDetail moment={moment} loadChanges={() => Promise.resolve([
            { kind: 'mod', text: 'Changed node api' },
        ])} />);
        expect(await screen.findByText('Changed node api')).toBeInTheDocument();

        rerender(<VersionDetail moment={moment} loadChanges={loadFirst} />);
        expect(screen.getByTestId('timeline-changes-loading')).toBeInTheDocument();

        rerender(<VersionDetail moment={moment} loadChanges={loadSecond} />);
        await act(async () => first.resolve([{ kind: 'del', text: 'Removed node old' }]));
        expect(screen.queryByText('Removed node old')).not.toBeInTheDocument();
        expect(screen.getByTestId('timeline-changes-loading')).toBeInTheDocument();

        await act(async () => second.resolve([{ kind: 'add', text: 'Added node new' }]));
        expect(screen.getByText('Added node new')).toBeInTheDocument();
    });
});
