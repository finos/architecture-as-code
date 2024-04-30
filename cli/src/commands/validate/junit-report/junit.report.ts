import junitReportBuilder, { TestSuite } from 'junit-report-builder';
import { ValidationOutput } from '../validation.output';

export default function createJUnitReport(
    jsonSchemaValidationOutput: ValidationOutput[], 
    spectralValidationOutput: ValidationOutput[], 
    spectralRulesName: string[],
    outputLocation: string
){
    const builder = junitReportBuilder.newBuilder();

    const jsonSchemaSuite = createTestSuite(builder, 'JSON Schema Validation');
    
    if (jsonSchemaValidationOutput.length <= 0) {
        createSucceedingTestCase(jsonSchemaSuite, 'JSON Schema Validation succeeded');
    } else {
        jsonSchemaValidationOutput.forEach(jsonSchemaError => {
            const testName = `${jsonSchemaError.message} at ${jsonSchemaError.schemaPath}`;
            createFailingTestCase(jsonSchemaSuite, testName);
        });
    }

    const spectralSuite = createTestSuite(builder, 'Spectral Suite');

    if (spectralValidationOutput.length <= 0) {
        spectralRulesName.forEach(ruleName => createSucceedingTestCase(spectralSuite,ruleName));
    } else {
        spectralRulesName.forEach(ruleName => {
            if (spectralValidationOutput.filter(item => (item.code === ruleName) && item.severity === 'error').length > 0) {
                createFailingTestCase(spectralSuite, ruleName);
            } else {
                createSucceedingTestCase(spectralSuite, ruleName);
            }
        });
    }

    builder.writeTo(outputLocation);
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

