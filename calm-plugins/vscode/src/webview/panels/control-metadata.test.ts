import { describe, it, expect } from 'vitest';
import {
    seedBaseConstants,
    getRequirementUrl,
    hasConfigUrl,
    getPropertyValue,
    setPropertyValue,
    buildControlEntry,
    enrichControlWithRequirement,
    needsEnrichment,
    latestVersion,
    type ControlEntry,
} from './control-metadata';
import type { ParsedRequirement } from '../../extension/services/requirement-parser';

const parsed: ParsedRequirement = {
    identity: {
        controlId: 'security-001',
        name: 'Micro-segmentation',
        description: 'Prevent lateral movement',
    },
    properties: {
        'permit-ingress': { type: 'boolean', required: true },
        reason: { type: 'string', required: false },
    },
};

describe('seedBaseConstants', () => {
    it('maps identity into the base config constants', () => {
        expect(seedBaseConstants(parsed.identity)).toEqual({
            'control-id': 'security-001',
            name: 'Micro-segmentation',
            description: 'Prevent lateral movement',
        });
    });
});

describe('requirement + config accessors', () => {
    const control: ControlEntry = {
        requirements: [
            {
                'requirement-url': 'controls/x.requirement.json',
                config: { reason: 'because' },
            },
        ],
    };

    it('reads the requirement url', () => {
        expect(getRequirementUrl(control)).toBe('controls/x.requirement.json');
    });

    it('detects config-url presence', () => {
        expect(hasConfigUrl(control)).toBe(false);
        expect(hasConfigUrl({ requirements: [{ 'config-url': 'controls/c.json' }] })).toBe(true);
    });

    it('reads a property value', () => {
        expect(getPropertyValue(control, 'reason')).toBe('because');
        expect(getPropertyValue(control, 'missing')).toBeUndefined();
    });

    it('immutably sets a property value, preserving existing config', () => {
        const updated = setPropertyValue(control, 'permit-ingress', true);
        expect(updated.requirements?.[0].config).toEqual({ reason: 'because', 'permit-ingress': true });
        // original untouched
        expect(control.requirements?.[0].config).toEqual({ reason: 'because' });
    });

    it('setPropertyValue seeds a requirement when none exists', () => {
        const updated = setPropertyValue({}, 'k', 1);
        expect(updated.requirements?.[0].config).toEqual({ k: 1 });
    });
});

describe('buildControlEntry', () => {
    it('builds a schema-valid entry with seeded base constants and no metadata.validation', () => {
        const entry = buildControlEntry('security:controls:micro-segmentation@1.0.0', parsed);
        expect(entry).toEqual({
            description: 'Prevent lateral movement',
            requirements: [
                {
                    'requirement-url': 'security:controls:micro-segmentation@1.0.0',
                    config: {
                        'control-id': 'security-001',
                        name: 'Micro-segmentation',
                        description: 'Prevent lateral movement',
                    },
                },
            ],
        });
        expect(entry.metadata).toBeUndefined();
    });
});

describe('enrichControlWithRequirement', () => {
    it('seeds missing base constants while preserving user values and omits metadata', () => {
        const control: ControlEntry = {
            description: '',
            requirements: [
                {
                    'requirement-url': 'controls/x.requirement.json',
                    config: { reason: 'kept', 'control-id': 'user-override' },
                },
            ],
            metadata: { validation: { legacy: true } },
        };
        const enriched = enrichControlWithRequirement(control, parsed);
        // existing custom value preserved; user-set control-id preserved; missing name/description seeded
        expect(enriched.requirements?.[0].config).toEqual({
            reason: 'kept',
            'control-id': 'user-override',
            name: 'Micro-segmentation',
            description: 'Prevent lateral movement',
        });
        // fallback description filled from identity
        expect(enriched.description).toBe('Prevent lateral movement');
        expect(enriched.metadata).toBeUndefined();
    });

    it('does not overwrite a non-empty description', () => {
        const control: ControlEntry = { description: 'custom', requirements: [{ 'requirement-url': 'r', config: {} }] };
        expect(enrichControlWithRequirement(control, parsed).description).toBe('custom');
    });
});

describe('needsEnrichment', () => {
    it('is true when a requirement-url exists and config is not seeded', () => {
        expect(needsEnrichment({ requirements: [{ 'requirement-url': 'r' }] })).toBe(true);
    });

    it('is false once enriched', () => {
        const enriched = enrichControlWithRequirement({ requirements: [{ 'requirement-url': 'r', config: {} }] }, parsed);
        expect(needsEnrichment(enriched)).toBe(false);
    });

    it('is false when config-url is present', () => {
        const stub: ControlEntry = {
            requirements: [{ 'requirement-url': 'domain:controls:ctrl', 'config-url': 'https://hub/config.json' }],
        };
        expect(needsEnrichment(stub)).toBe(false);
    });

    it('is false when there is no requirement-url', () => {
        expect(needsEnrichment({ requirements: [{ config: { value: 'x' } }] })).toBe(false);
    });
});

describe('enrichControlWithRequirement — config-url', () => {
    it('does not add inline config when config-url is present', () => {
        const control: ControlEntry = {
            requirements: [{ 'requirement-url': 'domain:controls:ctrl', 'config-url': 'https://hub/config.json' }],
        };
        const enriched = enrichControlWithRequirement(control, parsed);
        expect(enriched.requirements![0]['config-url']).toBe('https://hub/config.json');
        expect(enriched.requirements![0].config).toBeUndefined();
    });

    it('adds inline config when no config-url is present', () => {
        const control: ControlEntry = {
            requirements: [{ 'requirement-url': 'domain:controls:ctrl' }],
        };
        const enriched = enrichControlWithRequirement(control, parsed);
        expect(enriched.requirements![0].config).toBeDefined();
    });
});

describe('latestVersion', () => {
    it('returns the last (latest) element', () => {
        expect(latestVersion(['1.0.0', '1.1.0', '2.0.0'])).toBe('2.0.0');
    });
    it('returns undefined for an empty list', () => {
        expect(latestVersion([])).toBeUndefined();
    });
});
