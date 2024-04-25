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

describe('createJUnitReport', () => {

    it('should create a report with only JSON Schema Validations errors', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir()));
        const jUnitReportLocation = tmpDir + '/test-report.xml';
        createJUnitReport(jsonSchemaValidationOutput, [], jUnitReportLocation);
        expect(fs.existsSync(tmpDir + '/test-report.xml')).toBe(true);
        fs.rmSync(tmpDir, {recursive: true});
    });

    it('should create a report with only Spectral issues', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir()));
        const jUnitReportLocation = tmpDir + '/test-report.xml';
        createJUnitReport([], spectralValidationOutput, jUnitReportLocation);
        expect(fs.existsSync(tmpDir + '/test-report.xml')).toBe(true);
        fs.rmSync(tmpDir, {recursive: true});
    });

    it('should create a report with Spectral issues and JSON Schema errors', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir()));
        const jUnitReportLocation = tmpDir + '/test-report.xml';
        createJUnitReport(jsonSchemaValidationOutput, spectralValidationOutput, jUnitReportLocation);
        expect(fs.existsSync(tmpDir + '/test-report.xml')).toBe(true);
        fs.rmSync(tmpDir, {recursive: true});
    });

    it('should create a report with no Spectral issues and no JSON Schema errors', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir()));
        const jUnitReportLocation = tmpDir + '/test-report.xml';
        createJUnitReport([], [], jUnitReportLocation);
        expect(fs.existsSync(tmpDir + '/test-report.xml')).toBe(true);
        fs.rmSync(tmpDir, {recursive: true});
    });

});
