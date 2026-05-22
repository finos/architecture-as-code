import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CompareBar } from './CompareBar.js';

const versions = ['2.0.0', '1.5.0', '1.0.0'];

describe('CompareBar', () => {
    it('renders both version selectors with all versions', () => {
        render(
            <CompareBar
                versions={versions}
                versionA="1.0.0"
                versionB="2.0.0"
                onChangeA={vi.fn()}
                onChangeB={vi.fn()}
                onExit={vi.fn()}
            />
        );

        const baseline = screen.getByLabelText('Baseline version') as HTMLSelectElement;
        const comparison = screen.getByLabelText('Comparison version') as HTMLSelectElement;
        expect(baseline.value).toBe('1.0.0');
        expect(comparison.value).toBe('2.0.0');
        expect(baseline.querySelectorAll('option')).toHaveLength(3);
    });

    it('fires onChangeA when the baseline version changes', () => {
        const onChangeA = vi.fn();
        render(
            <CompareBar
                versions={versions}
                versionA="1.0.0"
                versionB="2.0.0"
                onChangeA={onChangeA}
                onChangeB={vi.fn()}
                onExit={vi.fn()}
            />
        );

        fireEvent.change(screen.getByLabelText('Baseline version'), { target: { value: '1.5.0' } });
        expect(onChangeA).toHaveBeenCalledWith('1.5.0');
    });

    it('fires onExit when the close button is clicked', () => {
        const onExit = vi.fn();
        render(
            <CompareBar
                versions={versions}
                versionA="1.0.0"
                versionB="2.0.0"
                onChangeA={vi.fn()}
                onChangeB={vi.fn()}
                onExit={onExit}
            />
        );

        fireEvent.click(screen.getByLabelText('Exit compare'));
        expect(onExit).toHaveBeenCalled();
    });
});
