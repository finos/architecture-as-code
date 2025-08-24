/* eslint-disable  @typescript-eslint/no-explicit-any */
import {CalmCore} from '@finos/calm-models/model';

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
    getTransformedModel(architecture: CalmCore): any;
    registerTemplateHelpers(): Record<string, (...args: any[]) => any>;
}
