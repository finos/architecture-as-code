import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimelineHeader } from './TimelineHeader.js';

describe('TimelineHeader', () => {
    it('prepends "v" for semver versions', () => {
        render(<TimelineHeader currentVersion="1.5.0" />);
        const pill = screen.getByTestId('timeline-version-pill');
        expect(pill).toHaveTextContent('v1.5.0');
    });

    it('does not prepend "v" for commit SHAs', () => {
        render(<TimelineHeader currentVersion="cb7686e" />);
        const pill = screen.getByTestId('timeline-version-pill');
        expect(pill).toHaveTextContent('cb7686e');
        expect(pill.textContent).not.toMatch(/^v/);
    });

    it('does not prepend "v" for full-length commit SHAs', () => {
        render(<TimelineHeader currentVersion="e46b2d5a1f3c9d8b7e2a0f4c6d8e1b3a5c7d9f0e" />);
        const pill = screen.getByTestId('timeline-version-pill');
        expect(pill.textContent).not.toMatch(/^v/);
    });

    it('prepends "v" for versions with non-hex characters', () => {
        render(<TimelineHeader currentVersion="2.0.0-beta" />);
        const pill = screen.getByTestId('timeline-version-pill');
        expect(pill).toHaveTextContent('v2.0.0-beta');
    });

    it('sets the title attribute with the raw version', () => {
        render(<TimelineHeader currentVersion="cb7686e" />);
        const pill = screen.getByTestId('timeline-version-pill');
        expect(pill).toHaveAttribute('title', 'Viewing version cb7686e');
    });
});
