export class ValidationOutput {
    public code: string | number;
    public severity: string;
    public message: string;
    public path: string;
    public schemaPath: string | undefined;


    constructor(code: string | number, severity: string, message: string, path: string, schemaPath?: string){
        this.code = code;
        this.severity = severity;
        this.message = message;
        this.path = path;
        this.schemaPath = schemaPath;
    }
} 