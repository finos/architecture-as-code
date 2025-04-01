/* eslint-disable  @typescript-eslint/no-explicit-any */
export interface IndexFile {
    name: string;
    transformer?: string;
    templates: TemplateEntry[];
}

export interface TemplateEntry {
    template: string;
    from: string;
    output: string;
    'output-type': string;
    partials?: string[];
}

export interface CalmTemplateTransformer {
    getTransformedModel(calmJson: string): any;
    registerTemplateHelpers(): Record<string, (...args: any[]) => any>;
}
