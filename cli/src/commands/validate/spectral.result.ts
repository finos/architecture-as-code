import { ValidationOutput } from './validation.output';

export class SpectralResult {
    public errors: boolean;
    public spectralIssues: ValidationOutput[];

    constructor(errors: boolean, spectralIssues: ValidationOutput[]) {
        this.errors = errors;
        this.spectralIssues = spectralIssues;
    }

}