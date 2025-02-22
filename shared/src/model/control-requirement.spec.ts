import { CalmControlRequirement } from './control-requirement.js'; // Importing the model
import { CalmControlRequirementSchema } from '../types/control-requirement-types.js'; // Importing the schema

// Mock data for testing
const controlRequirementData: CalmControlRequirementSchema = {
    'control-id': 'control-123',
    name: 'Test Control Requirement',
    description: 'This is a description of the test control requirement.'
};

describe('CalmControlRequirement', () => {
    it('should create a CalmControlRequirement instance from JSON data', () => {
        const controlRequirement = CalmControlRequirement.fromJson(controlRequirementData);

        expect(controlRequirement).toBeInstanceOf(CalmControlRequirement);
        expect(controlRequirement.controlId).toBe('control-123');
        expect(controlRequirement.name).toBe('Test Control Requirement');
        expect(controlRequirement.description).toBe('This is a description of the test control requirement.');
    });

    it('should handle missing description', () => {
        const controlRequirementWithNoDescription: CalmControlRequirementSchema = {
            'control-id': 'control-124',
            name: 'Control with No Description',
            description: ''
        };
        const controlRequirement = CalmControlRequirement.fromJson(controlRequirementWithNoDescription);

        expect(controlRequirement).toBeInstanceOf(CalmControlRequirement);
        expect(controlRequirement.controlId).toBe('control-124');
        expect(controlRequirement.name).toBe('Control with No Description');
        expect(controlRequirement.description).toBe('');
    });

});
