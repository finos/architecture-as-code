

import { ValidationOutcome, ValidationOutput } from '../validation.output';
import stringTable from 'string-table';

/**
 * Formats the validation outcome into a pretty-printed string for CLI output.
 *
 * @param validationOutcome - The outcome of the validation containing all validation outputs.
 * @returns A formatted string representing the validation results.
 */
export default function prettyFormat(validationOutcome: ValidationOutcome): string {

    const errorValidations = validationOutcome.allValidationOutputs().filter(output => output.severity === 'error');
    const warningValidations = validationOutcome.allValidationOutputs().filter(output => output.severity === 'warning');
    let returnText = '\n';

    const informationObjects = [
        {
            'Issue Type': 'Errors',
            'Issues Found?': validationOutcome.hasErrors.toString(),
            'Issue Count': errorValidations.length.toString()
        },
        {
            'Issue Type': 'Warnings',
            'Issues Found?': validationOutcome.hasWarnings.toString(),
            'Issue Count': warningValidations.length.toString()
        }
    ];


    const tableOutput = stringTable.create(informationObjects);
    returnText += tableOutput;
    returnText += '\n';
    returnText += formatValidations(errorValidations, 'Errors');
    returnText += '\n';
    returnText += formatValidations(warningValidations, 'Warnings');
    returnText += '\n';

    return returnText;
}

function formatValidations(validations: ValidationOutput[], severity: string): string {
    if (validations.length > 0) {
        let result = `\n${severity}:\n\n`;
        const tableOutput = stringTable.create(validations);
        result += tableOutput;
        return result;
    }
    return '';
}


