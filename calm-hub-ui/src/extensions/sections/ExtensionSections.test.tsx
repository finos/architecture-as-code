import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../../test-support/memory-storage.js';
import { ExtensionSections } from './ExtensionSections.js';

const sections = (count: number, content = vi.fn((id: string) => <p>{`content ${id}`}</p>)) =>
    Array.from({ length: count }, (_, i) => ({ id: `ext-${i + 1}`, title: `Extension ${i + 1}`, content: () => content(`ext-${i + 1}`) }));

const toggle = (name: string) => screen.getByText(name).closest('button')!;

describe('ExtensionSections', () => {
    it('opens only the first section, and renders the content of open sections only', () => {
        const content = vi.fn((id: string) => <p>{`content ${id}`}</p>);
        render(<ExtensionSections sections={sections(10, content)} storageKey="k" storage={createMemoryStorage()} />);
        expect(toggle('Extension 1')).toHaveAttribute('aria-expanded', 'true');
        for (let i = 2; i <= 10; i++) expect(toggle(`Extension ${i}`)).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByText('content ext-1')).toBeInTheDocument();
        expect(content.mock.calls.map(([id]) => id)).toEqual(['ext-1']);
    });

    it('remembers each choice per extension', async () => {
        const storage = createMemoryStorage();
        const view = render(<ExtensionSections sections={sections(3)} storageKey="k" storage={storage} />);
        await userEvent.click(toggle('Extension 1'));
        await userEvent.click(toggle('Extension 3'));
        expect(JSON.parse(storage.getItem('k')!)).toEqual({ 'ext-1': false, 'ext-3': true });
        view.unmount();

        render(<ExtensionSections sections={sections(3)} storageKey="k" storage={storage} />);
        expect(toggle('Extension 1')).toHaveAttribute('aria-expanded', 'false');
        expect(toggle('Extension 2')).toHaveAttribute('aria-expanded', 'false');
        expect(toggle('Extension 3')).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('content ext-3')).toBeInTheDocument();
    });

    it('writes a choice once, after the render, and writes nothing when there is no choice', async () => {
        const storage = createMemoryStorage();
        const setItem = vi.spyOn(storage, 'setItem');
        // StrictMode calls each state updater two times, so a write in an updater would run two times.
        render(
            <StrictMode>
                <ExtensionSections sections={sections(2)} storageKey="k" storage={storage} />
            </StrictMode>
        );
        expect(setItem).not.toHaveBeenCalled();
        await userEvent.click(toggle('Extension 2'));
        expect(setItem).toHaveBeenCalledTimes(1);
        expect(setItem).toHaveBeenCalledWith('k', JSON.stringify({ 'ext-2': true }));
    });

    it('keeps a choice for this visit when the storage refuses the write', async () => {
        const storage = createMemoryStorage();
        vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
        render(<ExtensionSections sections={sections(2)} storageKey="k" storage={storage} />);
        await userEvent.click(toggle('Extension 2'));
        expect(toggle('Extension 2')).toHaveAttribute('aria-expanded', 'true');
    });

    it('ignores a broken stored value', () => {
        const storage = createMemoryStorage();
        storage.setItem('k', '{not json');
        render(<ExtensionSections sections={sections(2)} storageKey="k" storage={storage} />);
        expect(toggle('Extension 1')).toHaveAttribute('aria-expanded', 'true');
    });

    it('shows a colour marker per extension', () => {
        render(<ExtensionSections sections={sections(2)} storageKey="k" storage={createMemoryStorage()} />);
        expect(screen.getAllByTestId('extension-marker')).toHaveLength(2);
    });
});
