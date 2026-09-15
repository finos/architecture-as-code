import { describe, it, expect } from 'vitest';
import {
    seedBaseConstants,
    isNewControlMetadata,
    isLegacyControl,
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

describe('metadata discrimination', () => {
    it('detects the new multi-property shape', () => {
        expect(isNewControlMetadata({ identity: parsed.identity, properties: {} })).toBe(true);
    });

    it('rejects the legacy shape', () => {
        expect(isNewControlMetadata({ pattern: '^x$' })).toBe(false);
        expect(isNewControlMetadata(undefined)).toBe(false);
    });

    it('isLegacyControl is true for a control with no properties metadata', () => {
        expect(isLegacyControl({ metadata: { validation: { pattern: '^x$' } } })).toBe(true);
        expect(isLegacyControl({ metadata: { validation: { identity: parsed.identity, properties: {} } } })).toBe(false);
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
    it('builds a full entry with seeded base constants and validation metadata', () => {
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
            metadata: {
                validation: { identity: parsed.identity, properties: parsed.properties },
            },
        });
    });
});

describe('enrichControlWithRequirement', () => {
    it('attaches validation and seeds missing base constants while preserving user values', () => {
        const control: ControlEntry = {
            description: '',
            requirements: [
                {
                    'requirement-url': 'controls/x.requirement.json',
                    config: { reason: 'kept', 'control-id': 'user-override' },
                },
            ],
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
        expect(isNewControlMetadata(enriched.metadata?.validation)).toBe(true);
    });

    it('does not overwrite a non-empty description', () => {
        const control: ControlEntry = { description: 'custom', requirements: [{ 'requirement-url': 'r', config: {} }] };
        expect(enrichControlWithRequirement(control, parsed).description).toBe('custom');
    });
});

describe('needsEnrichment', () => {
    it('is true when a requirement-url exists but no property metadata', () => {
        expect(needsEnrichment({ requirements: [{ 'requirement-url': 'r' }] })).toBe(true);
    });

    it('is false once enriched', () => {
        const enriched = enrichControlWithRequirement({ requirements: [{ 'requirement-url': 'r', config: {} }] }, parsed);
        expect(needsEnrichment(enriched)).toBe(false);
    });

    it('is false when there is no requirement-url', () => {
        expect(needsEnrichment({ requirements: [{ config: { value: 'x' } }] })).toBe(false);
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
