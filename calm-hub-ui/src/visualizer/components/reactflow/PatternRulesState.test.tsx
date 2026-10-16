import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PatternRulesState } from './PatternRulesState';
import { restoreLocation, setHostname } from '../../../test-support/window-location.js';
import type { PatternRules } from './utils/patternRules.js';

const GOVERNED_NODE = 'https://hub.calm.finos.org/calm/namespaces/finos.agentic-sdlc/standards/governed-node/versions/1.0.0';

const rules: PatternRules = {
    description: 'How this estate enforces the SDLC Common Controls on every architecture.',
    nodeStandards: [GOVERNED_NODE],
    relationshipStandards: [],
    requiredControls: ['sdlc-prev-001-code-review', 'sdlc-prev-012-deployment-gating'],
};

describe('PatternRulesState', () => {
    afterEach(() => restoreLocation());

    it('explains that the pattern sets rules instead of a structure', () => {
        render(<PatternRulesState rules={rules} />);

        expect(screen.getByRole('heading', { name: 'This pattern sets rules, not a structure' })).toBeInTheDocument();
        expect(screen.getByText(/no fixed nodes or relationships to draw/)).toBeInTheDocument();
        expect(screen.getByText(rules.description!)).toBeInTheDocument();
        expect(screen.getByText(/See the JSON view/)).toBeInTheDocument();
    });

    it('links a Standard on this CALM Hub in-app', () => {
        setHostname('hub.calm.finos.org');

        render(<PatternRulesState rules={rules} />);

        const link = screen.getByRole('link', { name: 'governed-node 1.0.0' });
        expect(link).toHaveAttribute('href', '#/finos.agentic-sdlc/standards/governed-node/1.0.0');
        expect(link).not.toHaveAttribute('target');
    });

    it('opens a Standard elsewhere in a new tab', () => {
        setHostname('localhost');

        render(<PatternRulesState rules={rules} />);

        const link = screen.getByRole('link', { name: /governed-node 1.0.0/ });
        expect(link).toHaveAttribute('href', 'https://hub.calm.finos.org/#/finos.agentic-sdlc/standards/governed-node/1.0.0');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('shows a relative Standard reference as text', () => {
        render(<PatternRulesState rules={{ ...rules, nodeStandards: ['standards/node.json'] }} />);

        expect(screen.getByText('standards/node.json')).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('lists the required controls', () => {
        render(<PatternRulesState rules={rules} />);

        const list = screen.getByRole('list', { name: 'Required controls' });
        expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(rules.requiredControls);
    });

    it('lists relationship Standards under their own heading', () => {
        render(<PatternRulesState rules={{ ...rules, relationshipStandards: ['standards/link.json'] }} />);

        const list = screen.getByRole('list', { name: 'Every relationship must follow' });
        expect(within(list).getByText('standards/link.json')).toBeInTheDocument();
    });

    it('leaves out sections that have nothing to show', () => {
        render(<PatternRulesState rules={{ nodeStandards: [], relationshipStandards: [], requiredControls: ['code-review'] }} />);

        expect(screen.queryByRole('list', { name: 'Every node must follow' })).not.toBeInTheDocument();
        expect(screen.queryByRole('list', { name: 'Every relationship must follow' })).not.toBeInTheDocument();
        expect(screen.getByRole('list', { name: 'Required controls' })).toBeInTheDocument();
    });
});
