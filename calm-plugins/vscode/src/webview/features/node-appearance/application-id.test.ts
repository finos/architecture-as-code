import { describe, expect, it } from 'vitest';
import { getApplicationId } from './application-id';

describe('getApplicationId', () => {
    it.each(['application-id', 'application_id'])('reads the configured value from a %s control', (controlName) => {
        expect(getApplicationId({
            controls: {
                [controlName]: {
                    requirements: [{ 'requirement-url': `controls:${controlName}`, config: { value: ' APP-42 ' } }],
                },
            },
        })).toBe('APP-42');
    });

    it('recognizes an application ID from the requirement URL when the map key is opaque', () => {
        expect(getApplicationId({
            controls: {
                control1: {
                    requirements: [{ 'requirement-url': 'controls:application_id', config: { value: 'APP-7' } }],
                },
            },
        })).toBe('APP-7');
    });

    it('falls back to either metadata spelling when the control has no configured value', () => {
        expect(getApplicationId({ metadata: { application_id: 'APP-META' } })).toBe('APP-META');
    });
});