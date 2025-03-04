import { CalmControl, CalmControlDetail } from './control.js';
import { CalmControlDetailSchema, CalmControlsSchema } from '../types/control-types.js';

const controlDetailData: CalmControlDetailSchema = {
    'control-requirement-url': 'https://example.com/requirement',
    'control-config-url': 'https://example.com/config'
};

const controlData: CalmControlsSchema = {
    'control-1': {
        description: 'Test Control 1',
        requirements: [controlDetailData]
    },
    'control-2': {
        description: 'Test Control 2',
        requirements: [controlDetailData]
    }
};

describe('CalmControlDetail', () => {
    it('should create a CalmControlDetail instance from JSON data', () => {
        const controlDetail = CalmControlDetail.fromJson(controlDetailData);

        expect(controlDetail).toBeInstanceOf(CalmControlDetail);
        expect(controlDetail.controlRequirementUrl).toBe('https://example.com/requirement');
        expect(controlDetail.controlConfigUrl).toBe('https://example.com/config');
    });
});

describe('CalmControl', () => {
    it('should create a CalmControl instance from JSON data', () => {
        const controls = CalmControl.fromJson(controlData);

        expect(controls).toHaveLength(2);
        expect(controls[0]).toBeInstanceOf(CalmControl);
        expect(controls[0].controlId).toBe('control-1');
        expect(controls[0].description).toBe('Test Control 1');
        expect(controls[0].requirements).toHaveLength(1);
        expect(controls[0].requirements[0]).toBeInstanceOf(CalmControlDetail);
        expect(controls[0].requirements[0].controlRequirementUrl).toBe('https://example.com/requirement');
        expect(controls[0].requirements[0].controlConfigUrl).toBe('https://example.com/config');
    });

    it('should handle an empty ControlsSchema', () => {
        const emptyControls: CalmControlsSchema = {};
        const controls = CalmControl.fromJson(emptyControls);

        expect(controls).toHaveLength(0);
    });

    it('should handle missing requirements in Control', () => {
        const controlWithNoRequirements: CalmControlsSchema = {
            'control-3': {
                description: 'Control with no requirements',
                requirements: []
            }
        };
        const controls = CalmControl.fromJson(controlWithNoRequirements);

        expect(controls).toHaveLength(1);
        expect(controls[0].requirements).toHaveLength(0);
    });

    it('should handle multiple controls and requirements', () => {
        const controlWithMultipleRequirements: CalmControlsSchema = {
            'control-4': {
                description: 'Control with multiple requirements',
                requirements: [
                    { 'control-requirement-url': 'https://example.com/requirement-1', 'control-config-url': 'https://example.com/config-1' },
                    { 'control-requirement-url': 'https://example.com/requirement-2', 'control-config-url': 'https://example.com/config-2' }
                ]
            }
        };

        const controls = CalmControl.fromJson(controlWithMultipleRequirements);

        expect(controls).toHaveLength(1);
        expect(controls[0].controlId).toBe('control-4');
        expect(controls[0].requirements).toHaveLength(2);
        expect(controls[0].requirements[0].controlRequirementUrl).toBe('https://example.com/requirement-1');
        expect(controls[0].requirements[1].controlRequirementUrl).toBe('https://example.com/requirement-2');
    });
});
