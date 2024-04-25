import junitReportBuilder from 'junit-report-builder';
import { ValidationOutput } from '../validation.output';

export default function createJUnitReport(jsonSchemaValidationOutput: ValidationOutput[], runSpectralValidations: ValidationOutput[], location: string){
    
    const suite = junitReportBuilder
        .testSuite()
        .name('JSON Schema Validation');
    
    if (jsonSchemaValidationOutput.length <= 0) {

        suite.testCase()
            .name('JSON Schema Validation succeeded');

    } else {

        jsonSchemaValidationOutput.forEach(jsonSchemaError => {
            suite.testCase()
                .name(jsonSchemaError.message)
                .failure();
        });
        
    }

    const spectralSuite = junitReportBuilder
        .testSuite()
        .name('Spectral Suite');

    if (runSpectralValidations.length <= 0) {
        
        spectralSuite
            .testCase()
            .name('Spectral Validation');

    } else {
        
        runSpectralValidations.forEach(spectralIssue => {
            if(spectralIssue.severity == 'error'){
                spectralSuite.testCase()
                    .name(spectralIssue.message)
                    .failure();
            }else{
                spectralSuite.testCase()
                    .name(spectralIssue.message);
            }
        });

    }

    junitReportBuilder.writeTo(location);

}


