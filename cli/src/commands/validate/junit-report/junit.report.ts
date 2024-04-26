import junitReportBuilder, { TestSuite } from 'junit-report-builder';
import { ValidationOutput } from '../validation.output';

export default function createJUnitReport(
    jsonSchemaValidationOutput: ValidationOutput[], 
    spectralValidationOutput: ValidationOutput[], 
    spectralRules: string[],
    outputLocation: string
){
    const builder = junitReportBuilder.newBuilder();

    const jsonSchemaSuite = createTestSuite(builder, 'JSON Schema Validation');
    
    if (jsonSchemaValidationOutput.length <= 0) {
        createTestCase(jsonSchemaSuite, 'JSON Schema Validation succeeded');
    } else {
        jsonSchemaValidationOutput.forEach(jsonSchemaError => {
            jsonSchemaSuite.testCase()
                .name(jsonSchemaError.message)
                .failure();
        });
    }

    const spectralSuite = createTestSuite(builder, 'Spectral Suite');

    if (spectralValidationOutput.length <= 0) {
        spectralRules.forEach(ruleName => createTestCase(spectralSuite,ruleName));
    } else {
        spectralRules.forEach(ruleName => {
            if (spectralValidationOutput.filter(item => (item.code === ruleName) && item.severity === 'error').length > 0) {
                spectralSuite.testCase()
                    .name(ruleName)
                    .failure();
            } else {
                createTestCase(spectralSuite, ruleName);
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

function createTestCase(testSuite: TestSuite, testName: string){
    testSuite.testCase()
        .name(testName);
}

