import junitReportBuilder, { TestSuite } from 'junit-report-builder';
import { ValidationOutcome } from '../validation.output';

export default function createJUnitReport(
    validationOutcome: ValidationOutcome,
    spectralRuleNames: string[]
): string {
    const builder = junitReportBuilder.newBuilder();

    const jsonSchemaSuite = createTestSuite(builder, 'JSON Schema Validation');
    const jsonSchemaValidationOutput = validationOutcome.jsonSchemaValidationOutputs;
    if (jsonSchemaValidationOutput.length <= 0) {
        createSucceedingTestCase(jsonSchemaSuite, 'JSON Schema Validation succeeded');
    } else {
        jsonSchemaValidationOutput.forEach(jsonSchemaError => {
            const testName = `${jsonSchemaError.message} at ${jsonSchemaError.schemaPath}`;
            createFailingTestCase(jsonSchemaSuite, testName);
        });
    }

    const spectralSuite = createTestSuite(builder, 'Spectral Suite');
    const spectralValidationOutput = validationOutcome.spectralSchemaValidationOutputs;
    if (spectralValidationOutput.length <= 0) {
        spectralRuleNames.forEach(ruleName => createSucceedingTestCase(spectralSuite,ruleName));
    } else {
        spectralRuleNames.forEach(ruleName => {
            if (spectralValidationOutput.filter(item => (item.code === ruleName) && item.severity === 'error').length > 0) {
                createFailingTestCase(spectralSuite, ruleName);
            } else {
                createSucceedingTestCase(spectralSuite, ruleName);
            }
        });
    }

    return builder.build();
}

function createTestSuite(builder, testSuiteName: string){
    return builder
        .testSuite()
        .name(testSuiteName);
}

function createSucceedingTestCase(testSuite: TestSuite, testName: string){
    testSuite.testCase()
        .name(testName);
}

function createFailingTestCase(testSuite: TestSuite, testName: string){
    testSuite.testCase()
        .name(testName)
        .failure();
}

