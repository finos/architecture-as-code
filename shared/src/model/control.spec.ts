import { CalmControl, CalmControlDetail } from './control.js';
import { CalmControlDetailSchema, CalmControlsSchema } from '../types/control-types.js';

const controlDetailWithUrl: CalmControlDetailSchema = {
    'requirement-url': 'https://example.com/requirement',
    'config-url': 'https://example.com/config'
};

const controlDetailWithInlineControl: CalmControlDetailSchema = {
    'requirement-url': 'https://example.com/requirement',
    'config': { foo: 'bar', threshold: 10 }
};

const controlData: CalmControlsSchema = {
    'control-1': {
        description: 'Test Control 1',
        requirements: [controlDetailWithUrl]
    },
    'control-2': {
        description: 'Test Control 2',
        requirements: [controlDetailWithUrl]
    }
};

describe('CalmControlDetail', () => {
    it('should create a CalmControlDetail instance from JSON data', () => {
        const controlDetail = CalmControlDetail.fromJson(controlDetailWithUrl);

        expect(controlDetail).toBeInstanceOf(CalmControlDetail);
        expect(controlDetail.requirementUrl).toBe('https://example.com/requirement');
        expect(controlDetail.configUrl).toBe('https://example.com/config');
    });

    it('should create a CalmControlDetail from object-based JSON', () => {
        const d = CalmControlDetail.fromJson(controlDetailWithInlineControl);
        expect(d).toBeInstanceOf(CalmControlDetail);
        expect(d.requirementUrl).toBe('https://example.com/requirement');
        expect(d.configUrl).toBeUndefined();
        expect(d.config).toEqual({ foo: 'bar', threshold: 10 });
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
        expect(controls[0].requirements[0].requirementUrl).toBe('https://example.com/requirement');
        expect(controls[0].requirements[0].configUrl).toBe('https://example.com/config');
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
                    { 'requirement-url': 'https://example.com/requirement-1', 'config-url': 'https://example.com/config-1' },
                    { 'requirement-url': 'https://example.com/requirement-2', 'config-url': 'https://example.com/config-2' }
                ]
            }
        };

        const controls = CalmControl.fromJson(controlWithMultipleRequirements);

        expect(controls).toHaveLength(1);
        expect(controls[0].controlId).toBe('control-4');
        expect(controls[0].requirements).toHaveLength(2);
        expect(controls[0].requirements[0].requirementUrl).toBe('https://example.com/requirement-1');
        expect(controls[0].requirements[1].requirementUrl).toBe('https://example.com/requirement-2');
    });

    it('should parse controls with mixed requirement types', () => {
        const mixControls: CalmControlsSchema = {
            'ctrl-url': {
                description: 'URL control',
                requirements: [controlDetailWithUrl]
            },
            'ctrl-obj': {
                description: 'Object control',
                requirements: [controlDetailWithInlineControl]
            }
        };
        const arr = CalmControl.fromJson(mixControls);
        expect(arr).toHaveLength(2);

        const urlCtrl = arr.find(c => c.controlId === 'ctrl-url')!;
        expect(urlCtrl.description).toBe('URL control');
        expect(urlCtrl.requirements[0].configUrl).toBe('https://example.com/config');
        expect(urlCtrl.requirements[0].config).toBeUndefined();

        const objCtrl = arr.find(c => c.controlId === 'ctrl-obj')!;
        expect(objCtrl.description).toBe('Object control');
        expect(objCtrl.requirements[0].configUrl).toBeUndefined();
        expect(objCtrl.requirements[0].config).toEqual({ foo: 'bar', threshold: 10 });
    });


});
