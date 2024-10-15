import { ValidationOutput } from './validation.output';

export class SpectralResult {
    public errors: boolean;
    public warnings: boolean;
    public spectralIssues: ValidationOutput[];

    constructor(warnings: boolean, errors: boolean, spectralIssues: ValidationOutput[]) {
        this.warnings = warnings;
        this.errors = errors;
        this.spectralIssues = spectralIssues;
    }

}