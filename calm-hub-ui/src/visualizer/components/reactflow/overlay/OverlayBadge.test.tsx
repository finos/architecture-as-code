import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverlayBadge, OverlayEdgeBadge } from './OverlayBadge.js';
import { OVERLAY_STYLES, overlayOutline } from './overlayStyle.js';
import { BUILTIN_DECORATOR_VIEWS } from '../../../../test-support/decorator-views.js';
import type { OverlayDecoratorView, OverlayStatus } from '../../../contracts/contracts.js';

const deploymentView = BUILTIN_DECORATOR_VIEWS.find((v) => v.id === 'deployment') as OverlayDecoratorView;
const shown = (status: OverlayStatus, value: string) => ({ view: deploymentView, overlay: { status, value, entries: [] } });

describe('OverlayBadge', () => {
    it.each([
        ['warn', 'rolled-back', 'Rolled back'],
        ['info', 'in-progress', 'In progress'],
        ['ok', 'completed', 'Completed'],
        ['error', 'failed', 'Failed'],
    ] as const)('draws a %s status in its text colour with the value as text', (status, value, text) => {
        render(<OverlayBadge shown={shown(status, value)} presenting={false} scale={1} />);
        const badge = screen.getByTestId('overlay-badge');
        expect(badge).toHaveTextContent(text);
        expect(badge.getAttribute('aria-label')).toBe(`Deployments: ${text}`);
        expect(badge.dataset.view).toBe('deployment');
        expect(badge.dataset.status).toBe(status);
        expect(badge.style.color).toBe(OVERLAY_STYLES[status].text);
    });

    it('grows in presentation mode', () => {
        render(<OverlayBadge shown={shown('ok', 'completed')} presenting scale={1} />);
        expect(screen.getByTestId('overlay-badge').style.fontSize).toBe('18px');
    });

    it('follows the diagram text size', () => {
        render(<OverlayBadge shown={shown('ok', 'completed')} presenting={false} scale={1.5} />);
        expect(screen.getByTestId('overlay-badge').style.fontSize).toBe('18px');
    });
});

describe('OverlayEdgeBadge', () => {
    it('shows the glyph and the value', () => {
        render(<OverlayEdgeBadge shown={shown('warn', 'rolled-back')} presenting={false} scale={1} />);
        const badge = screen.getByTestId('edge-overlay-badge');
        expect(badge).toHaveTextContent('! Rolled back');
        expect(badge.style.color).toBe(OVERLAY_STYLES.warn.text);
    });

    it('follows the diagram text size', () => {
        render(<OverlayEdgeBadge shown={shown('warn', 'rolled-back')} presenting={false} scale={2} />);
        expect(screen.getByTestId('edge-overlay-badge').style.fontSize).toBe('22px');
    });
});

describe('overlayOutline', () => {
    it('outlines only error and warn', () => {
        expect(overlayOutline('error')).toBe(OVERLAY_STYLES.error.accent);
        expect(overlayOutline('warn')).toBe(OVERLAY_STYLES.warn.accent);
        expect(overlayOutline('ok')).toBeUndefined();
        expect(overlayOutline('info')).toBeUndefined();
        expect(overlayOutline(undefined)).toBeUndefined();
    });
});
