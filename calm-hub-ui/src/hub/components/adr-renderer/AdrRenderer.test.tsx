import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdrRenderer } from '../../../hub/components/adr-renderer/AdrRenderer.js';
import { Option } from '../../../model/adr/option.js';
import { Adr } from '../../../model/calm.js';
import { adrStatus } from '../../../model/adr/adr-status/adrStatus.js';

describe('ADR Renderer', () => {
    const optionOne: Option = {
        name: 'Option one',
        description: 'Option one is **option one**',
        positiveConsequences: ['positive one', 'positive two'],
        negativeConsequences: ['negative one'],
    };
    const optionTwo: Option = {
        name: 'Option two',
        description: 'Option two is **option two**',
        positiveConsequences: ['positive three', 'positive four'],
        negativeConsequences: ['negative two', 'negative three'],
    };
    const chosenOption: Option = {
        name: 'Chosen option',
        description: 'Chosen option is **the chosen option**',
        positiveConsequences: ['positive five', 'positive six'],
        negativeConsequences: ['negative four'],
    };
    const adrDetails = {
        title: 'adr title',
        status: 'draft',
        creationDateTime: '2025-04-29T12:44:25.465265627',
        updateDateTime: '2025-04-30T12:50:25.465265627',
        contextAndProblemStatement: 'This is the markdown *context* and the markdown *problem*',
        decisionDrivers: ['decision driver one', 'decision driver two'],
        consideredOptions: [optionOne, optionTwo],
        decisionOutcome: { chosenOption: chosenOption, rationale: 'this is the best option' },
        links: [
            { href: 'http://my-link-one.com', rel: 'link one' },
            { href: 'http://my-link-two.com', rel: 'link two' },
        ],
    };
    const adr: Adr = {
        namespace: 'finos',
        id: 1,
        revision: 1,
        adr: adrDetails,
    };

    function renderAdr() {
        return render(<AdrRenderer adrDetails={adr} />);
    }

    it('should not render the ADR until it is selected', () => {
        render(<AdrRenderer adrDetails={undefined} />);
        expect(screen.getByText('Please select an ADR to load')).toBeInTheDocument();
    });

    it('should render the ADR view when ADR is selected', () => {
        renderAdr();
        expect(screen.getByText('Context and Problem')).toBeInTheDocument();
        expect(screen.getByText('Decision Drivers')).toBeInTheDocument();
        expect(screen.getByText('Considered Options')).toBeInTheDocument();
        expect(screen.getByText('Decision Outcome')).toBeInTheDocument();
        expect(screen.getByText('Relevant Links')).toBeInTheDocument();
    });

    it('should display the correct ADR title', () => {
        renderAdr();
        expect(screen.getByText('adr title')).toBeInTheDocument();
    });

    it('should display the correct ADR status', () => {
        renderAdr();
        expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('should display the correct context and problem statement with the correct styling', () => {
        renderAdr();
        expect(screen.getByText('This is the markdown', { exact: false })).toBeInTheDocument();
        expect(screen.getByText('context')).toBeInTheDocument();
        expect(screen.getByText('context')).toHaveRole('emphasis');
        expect(screen.getByText('and the markdown', { exact: false })).toBeInTheDocument();
        expect(screen.getByText('problem')).toBeInTheDocument();
        expect(screen.getByText('problem')).toHaveRole('emphasis');
    });

    it('should display the correct decision drivers', () => {
        renderAdr();
        expect(screen.getByText('decision driver one')).toBeInTheDocument();
        expect(screen.getByText('decision driver two')).toBeInTheDocument();
    });

    it('should display the correct considered options', () => {
        renderAdr();
        expect(screen.getByText('Option one')).toBeInTheDocument();
        expect(screen.getByText('Option one is')).toBeInTheDocument();
        expect(screen.getByText('option one')).toBeInTheDocument();
        expect(screen.getByText('option one')).toHaveRole('strong');
        expect(screen.getByText('positive one')).toBeInTheDocument();
        expect(screen.getByText('positive two')).toBeInTheDocument();
        expect(screen.getByText('negative one')).toBeInTheDocument();

        expect(screen.getByText('Option two')).toBeInTheDocument();
        expect(screen.getByText('Option two is')).toBeInTheDocument();
        expect(screen.getByText('option two')).toHaveRole('strong');
        expect(screen.getByText('positive three')).toBeInTheDocument();
        expect(screen.getByText('positive four')).toBeInTheDocument();
        expect(screen.getByText('negative two')).toBeInTheDocument();
    });

    it('should display the correct chosen options', () => {
        renderAdr();
        expect(screen.getByText('Chosen option')).toBeInTheDocument();
        expect(screen.getByText('Chosen option is')).toBeInTheDocument();
        expect(screen.getByText('the chosen option')).toHaveRole('strong');
        expect(screen.getByText('positive five')).toBeInTheDocument();
        expect(screen.getByText('positive six')).toBeInTheDocument();
        expect(screen.getByText('negative four')).toBeInTheDocument();
    });

    it('should display the correct links', () => {
        renderAdr();
        const links: HTMLAnchorElement[] = screen.getAllByRole('link');

        expect(links[0].textContent).toEqual('link one');
        expect(links[0].href).toContain('http://my-link-one.com');

        expect(links[1].textContent).toEqual('link two');
        expect(links[1].href).toContain('http://my-link-two.com');
    });

    it('should display the correct creation date', () => {
        renderAdr();
        expect(screen.getByText('Created on')).toBeInTheDocument();
        expect(screen.getByText('29 Apr, 2025', { exact: false })).toBeInTheDocument();
        expect(screen.getByText('12:44', { exact: false })).toBeInTheDocument();
    });

    it('should display the correct update date', () => {
        renderAdr();
        expect(screen.getByText('Last updated on')).toBeInTheDocument();
        expect(screen.getByText('30 Apr, 2025', { exact: false })).toBeInTheDocument();
        expect(screen.getByText('12:50', { exact: false })).toBeInTheDocument();
    });
});
