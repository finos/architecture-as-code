import { ValidationOutput } from '../validation.output';
import createJUnitReport from './junit.report';
import fs from 'fs';
import os from 'os';
import path from 'path';

const jsonSchemaValidationOutput: ValidationOutput[] = [
    new ValidationOutput(
        'json-schema',
        'error',
        'must be integer',
        '/path/to/node',
        '#/node'
    )
];

const spectralValidationOutput: ValidationOutput[] = [
    new ValidationOutput(
        'no-empty-properties',
        'error',
        'Must not contain string properties set to the empty string or numerical properties set to zero',
        '/relationships/0/relationship-type/connects/destination/interface'
    ),
    new ValidationOutput(
        'no-placeholder-properties-numerical',
        'warning',
        'Numerical placeholder (-1) detected in instantiated pattern.',
        '/nodes/0/interfaces/0/port'
    )
]; 

const ruleset = ['rules-number-1', 'rule-number-2', 'no-placeholder-properties-numerical', 'no-empty-properties'];


describe('createJUnitReport', () => {
    let jUnitReportLocation: string;
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir()));
        jUnitReportLocation = tmpDir + '/test-report.xml';
    });

    it('should create a report with only JSON Schema Validations errors', async () => {
        createJUnitReport(jsonSchemaValidationOutput, [], ruleset, jUnitReportLocation);
        
        expect(fs.existsSync(jUnitReportLocation)).toBe(true); //check if the file was created in the correct location
        
        const actual = fs.readFileSync(jUnitReportLocation, 'utf-8');

        const expected = `<?xml version="1.0" encoding="UTF-8"?>
        <testsuites tests="5" failures="1" errors="0" skipped="0">
          <testsuite name="JSON Schema Validation" tests="1" failures="1" errors="0" skipped="0">
            <testcase name="must be integer at #/node">
              <failure/>
            </testcase>
          </testsuite>
          <testsuite name="Spectral Suite" tests="4" failures="0" errors="0" skipped="0">
            <testcase name="rules-number-1"/>
            <testcase name="rule-number-2"/>
            <testcase name="no-placeholder-properties-numerical"/>
            <testcase name="no-empty-properties"/>
          </testsuite>
        </testsuites>`;

        expect(actual.replace(/\s/g, '')).toBe(expected.replace(/\s/g, ''));
    });

    it('should create a report with only Spectral issues', async () => {
        createJUnitReport([], spectralValidationOutput, ruleset, jUnitReportLocation);

        expect(fs.existsSync(jUnitReportLocation)).toBe(true); //check if the file was created in the correct location

        const actual = fs.readFileSync(jUnitReportLocation, 'utf-8');
        const expected = `<?xml version="1.0" encoding="UTF-8"?>
        <testsuites tests="5" failures="1" errors="0" skipped="0">
          <testsuite name="JSON Schema Validation" tests="1" failures="0" errors="0" skipped="0">
            <testcase name="JSON Schema Validation succeeded"/>
          </testsuite>
          <testsuite name="Spectral Suite" tests="4" failures="1" errors="0" skipped="0">
            <testcase name="rules-number-1"/>
            <testcase name="rule-number-2"/>
            <testcase name="no-placeholder-properties-numerical"/>
            <testcase name="no-empty-properties">
              <failure/>
            </testcase>
          </testsuite>
        </testsuites>`;
        expect(actual.replace(/\s/g, '')).toBe(expected.replace(/\s/g, ''));

    });

    it('should create a report with Spectral issues and JSON Schema errors', async () => {

        createJUnitReport(jsonSchemaValidationOutput, spectralValidationOutput, ruleset, jUnitReportLocation);

        expect(fs.existsSync(jUnitReportLocation)).toBe(true); //check if the file was created in the correct location

        const actual = fs.readFileSync(jUnitReportLocation, 'utf-8');
        const expected = `<?xml version="1.0" encoding="UTF-8"?>
        <testsuites tests="5" failures="2" errors="0" skipped="0">
          <testsuite name="JSON Schema Validation" tests="1" failures="1" errors="0" skipped="0">
            <testcase name="must be integer at #/node">
              <failure/>
            </testcase>
          </testsuite>
          <testsuite name="Spectral Suite" tests="4" failures="1" errors="0" skipped="0">
            <testcase name="rules-number-1"/>
            <testcase name="rule-number-2"/>
            <testcase name="no-placeholder-properties-numerical"/>
            <testcase name="no-empty-properties">
              <failure/>
            </testcase>
          </testsuite>
        </testsuites>`;
        expect(actual.replace(/\s/g, '')).toBe(expected.replace(/\s/g, ''));
    });

    it('should create a report with no Spectral issues and no JSON Schema errors', async () => {
        createJUnitReport([], [], ruleset, jUnitReportLocation);

        expect(fs.existsSync(jUnitReportLocation)).toBe(true); //check if the file was created in the correct location

        const actual = fs.readFileSync(jUnitReportLocation, 'utf-8');
        const expected = `<?xml version="1.0" encoding="UTF-8"?>
        <testsuites tests="5" failures="0" errors="0" skipped="0">
          <testsuite name="JSON Schema Validation" tests="1" failures="0" errors="0" skipped="0">
            <testcase name="JSON Schema Validation succeeded"/>
          </testsuite>
          <testsuite name="Spectral Suite" tests="4" failures="0" errors="0" skipped="0">
            <testcase name="rules-number-1"/>
            <testcase name="rule-number-2"/>
            <testcase name="no-placeholder-properties-numerical"/>
            <testcase name="no-empty-properties"/>
          </testsuite>
        </testsuites>`;
        expect(actual.replace(/\s/g, '')).toBe(expected.replace(/\s/g, ''));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, {recursive: true});
    });

});
