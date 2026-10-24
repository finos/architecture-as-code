import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FindingText } from './FindingText.js';
import { THEME } from './theme.js';

const finding = { subject: 'trade-api-to-client-ledger', description: 'A human approved this change' };

describe('FindingText', () => {
    it('frames the description as a requirement and leads with the subject', () => {
        const { container } = render(<p><FindingText finding={finding} /></p>);
        expect(container.textContent).toBe('trade-api-to-client-ledger — Requires: A human approved this change');
    });

    it('leaves the subject out when it is the element being described', () => {
        const { container } = render(<p><FindingText finding={finding} elementId="trade-api-to-client-ledger" /></p>);
        expect(container.textContent).toBe('Requires: A human approved this change');
    });

    it('appends the cause, muted', () => {
        const { container, getByText } = render(<p><FindingText finding={{ ...finding, cause: 'absent' }} elementId="trade-api-to-client-ledger" /></p>);
        expect(container.textContent).toBe('Requires: A human approved this change (absent)');
        expect(getByText('(absent)').style.color).toBe(THEME.colors.muted);
    });
});
