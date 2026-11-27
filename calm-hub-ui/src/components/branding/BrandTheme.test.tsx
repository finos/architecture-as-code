import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiConfigContext } from '../ui-config/UiConfigContext.js';
import { UiBranding } from '../../model/ui-config.js';
import { BrandTheme } from './BrandTheme.js';

function renderBrand(branding?: UiBranding) {
    return render(
        <UiConfigContext.Provider value={{ branding }}>
            <BrandTheme />
        </UiConfigContext.Provider>
    );
}

describe('BrandTheme', () => {
    beforeEach(() => {
        document.title = 'CALM';
    });

    it('changes nothing without branding', () => {
        renderBrand();
        expect(screen.queryByTestId('brand-theme')).not.toBeInTheDocument();
        expect(document.title).toBe('CALM');
    });

    it('names the page and styles both themes with the brand colour', () => {
        const { unmount } = renderBrand({ organisationName: 'Northstar Financial', applicationName: 'Architecture Hub', colour: '#0f766e' });

        expect(document.title).toBe('Architecture Hub · Northstar Financial');
        const css = screen.getByTestId('brand-theme').textContent;
        expect(css).toContain("html:root[data-theme='light'] { --color-primary: #0f766e;");
        expect(css).toContain("html:root[data-theme='dark']");

        unmount();
        expect(document.title).toBe('CALM');
    });
});
