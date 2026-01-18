export class ValidationOutput {

    public code: string | number;
    public severity: string;
    public message: string;
    public path: string;
    public schemaPath: string | undefined;
    public line_start: number | undefined;
    public line_end: number | undefined;
    public character_start: number | undefined;
    public character_end: number | undefined;
    public source: string | undefined;

    constructor(code: string | number, severity: string, message: string, path: string, schemaPath?: string, line_start?: number, line_end?: number, character_start?: number, character_end?: number, source?: string) {
        this.code = code;
        this.severity = severity;
        this.message = message;
        this.path = path;
        this.schemaPath = schemaPath;
        this.line_start = line_start;
        this.line_end = line_end;
        this.character_start = character_start;
        this.character_end = character_end;
        this.source = source;
    }
}

export class ValidationOutcome {

    public jsonSchemaValidationOutputs: ValidationOutput[];
    public spectralSchemaValidationOutputs: ValidationOutput[];
    public hasErrors: boolean;
    public hasWarnings: boolean;

    constructor(jsonSchemaValidationOutputs: ValidationOutput[], spectralSchemaValidationOutputs: ValidationOutput[], hasErrors: boolean, hasWarnings: boolean) {
        this.jsonSchemaValidationOutputs = jsonSchemaValidationOutputs;
        this.spectralSchemaValidationOutputs = spectralSchemaValidationOutputs;
        this.hasErrors = hasErrors;
        this.hasWarnings = hasWarnings;
    }

    //Gaze into the Javascript abyss. Type safety cannot save you here.
    allValidationOutputs(): ValidationOutput[] {
        return [...(this.jsonSchemaValidationOutputs || []), ...(this.spectralSchemaValidationOutputs || [])];
    }
}