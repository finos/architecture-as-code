import {
    CalmAdr,
    CalmAdrMeta,
    CalmOption,
    CalmAdrDecision,
    CalmLink,
} from './adr';
import {
    CalmAdrMetaSchema,
    CalmAdrSchema,
    CalmAdrStatus,
    CalmAdrOptionSchema,
    CalmAdrDecisionSchema,
    CalmAdrLinkSchema,
} from '../types/adr-types';

describe('CalmAdrMeta', () => {
    it('should create a CalmAdrMeta instance from JSON data', () => {
        const adr = new CalmAdr(
            'Test ADR',
            'draft' as CalmAdrStatus,
            '2024-01-01T00:00:00Z',
            '2024-01-02T00:00:00Z',
            'Problem statement',
            ['Driver 1'],
            [new CalmOption('Option 1', 'Desc', ['+'], ['-'])],
            new CalmAdrDecision(
                new CalmOption('Option 1', 'Desc', ['+'], ['-']),
                'Rationale'
            ),
            [new CalmLink('related', 'http://example.com')]
        );
        const metaJson: CalmAdrMetaSchema = {
            namespace: 'test-ns',
            id: 1,
            revision: 2,
            adr,
        };
        const meta = CalmAdrMeta.fromJson(metaJson);
        expect(meta).toBeInstanceOf(CalmAdrMeta);
        expect(meta.namespace).toBe('test-ns');
        expect(meta.id).toBe(1);
        expect(meta.revision).toBe(2);
        expect(meta.adr).toBe(adr);
    });
});

describe('CalmAdr', () => {
    it('should create a CalmAdr instance from JSON data', () => {
        const adrJson: CalmAdrSchema = {
            title: 'Test ADR',
            status: 'accepted' as CalmAdrStatus,
            creationDateTime: '2024-01-01T00:00:00Z',
            updateDateTime: '2024-01-02T00:00:00Z',
            contextAndProblemStatement: 'Some context',
            decisionDrivers: ['Driver 1', 'Driver 2'],
            consideredOptions: [
                {
                    name: 'Option 1',
                    description: 'Desc',
                    positiveConsequences: ['+'],
                    negativeConsequences: ['-'],
                },
                {
                    name: 'Option 2',
                    description: 'Another Desc',
                    positiveConsequences: ['+'],
                    negativeConsequences: ['-'],
                },
            ],
            decisionOutcome: {
                chosenOption: {
                    name: 'Option 1',
                    description: 'Desc',
                    positiveConsequences: ['+'],
                    negativeConsequences: ['-'],
                },
                rationale: 'Rationale',
            },
            links: [
                { rel: 'related', href: 'http://example.com' },
                { rel: 'alternate', href: 'http://example.org' },
            ],
        };
        const adr = CalmAdr.fromJson(adrJson);
        expect(adr).toBeInstanceOf(CalmAdr);
        expect(adr.title).toBe('Test ADR');
        expect(adr.status).toBe('accepted');
        expect(adr.consideredOptions[0]).toBeInstanceOf(CalmOption);
        expect(adr.consideredOptions[1]).toBeInstanceOf(CalmOption);
        expect(adr.links[0]).toBeInstanceOf(CalmLink);
        expect(adr.links[1]).toBeInstanceOf(CalmLink);
        expect(adr.decisionDrivers.length).toBe(2);
    });
});

describe('Option', () => {
    it('should create an Option instance from JSON data', () => {
        const optionJson: CalmAdrOptionSchema = {
            name: 'Option 1',
            description: 'Description',
            positiveConsequences: ['+'],
            negativeConsequences: ['-'],
        };
        const option = CalmOption.fromJson(optionJson);
        expect(option).toBeInstanceOf(CalmOption);
        expect(option.name).toBe('Option 1');
        expect(option.description).toBe('Description');
        expect(option.positiveConsequences).toContain('+');
        expect(option.negativeConsequences).toContain('-');
    });
});

describe('Decision', () => {
    it('should create a Decision instance from JSON data', () => {
        const decisionJson: CalmAdrDecisionSchema = {
            chosenOption: {
                name: 'Option 1',
                description: 'Description',
                positiveConsequences: ['+'],
                negativeConsequences: ['-'],
            },
            rationale: 'Some rationale',
        };
        const decision = CalmAdrDecision.fromJson(decisionJson);
        expect(decision).toBeInstanceOf(CalmAdrDecision);
        expect(decision.chosenOption).toBeInstanceOf(CalmOption);
        expect(decision.rationale).toBe('Some rationale');
        expect(decision.chosenOption.name).toBe('Option 1');
        expect(decision.chosenOption.description).toBe('Description');
        expect(decision.chosenOption.positiveConsequences).toContain('+');
        expect(decision.chosenOption.negativeConsequences).toContain('-');
    });
});

describe('Link', () => {
    it('should create a Link instance from JSON data', () => {
        const linkJson: CalmAdrLinkSchema = {
            rel: 'related',
            href: 'http://example.com',
        };
        const link = CalmLink.fromJson(linkJson);
        expect(link).toBeInstanceOf(CalmLink);
        expect(link.rel).toBe('related');
        expect(link.href).toBe('http://example.com');
    });
});
