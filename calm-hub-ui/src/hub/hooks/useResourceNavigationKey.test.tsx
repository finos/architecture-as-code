import { act, render } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useResourceNavigationKey } from './useResourceNavigationKey.js';

function renderKeys(path: string) {
    const keys: string[] = [];
    let navigate: NavigateFunction = () => {};
    function Probe() {
        navigate = useNavigate();
        keys.push(useResourceNavigationKey(useLocation()));
        return null;
    }
    render(
        <MemoryRouter initialEntries={[path]}>
            <Probe />
        </MemoryRouter>
    );
    const go = (to: string) => act(() => void navigate(to));
    const last = () => keys[keys.length - 1];
    return { go, last };
}

describe('useResourceNavigationKey', () => {
    it('keeps the key when only the query changes', () => {
        const { go, last } = renderKeys('/finos/patterns/api-gateway/1.0.0');
        const first = last();

        go('/finos/patterns/api-gateway/1.0.0?tab=json');
        go('/finos/patterns/api-gateway/1.0.0?tab=used-by');

        expect(last()).toBe(first);
    });

    it('changes the key when the path changes', () => {
        const { go, last } = renderKeys('/finos/patterns/api-gateway/1.0.0?tab=json');
        const first = last();

        go('/finos/patterns/api-gateway/2.0.0?tab=json');

        expect(last()).not.toBe(first);
    });

    it('changes the key on a navigation to the same path and query', () => {
        const { go, last } = renderKeys('/domain/security');
        const first = last();

        go('/domain/security');

        expect(last()).not.toBe(first);
    });
});
