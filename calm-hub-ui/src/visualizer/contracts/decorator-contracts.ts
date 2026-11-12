export type DecoratorData = Record<string, unknown>;

export interface Decorator {
    schema?: string;
    uniqueId: string;
    /** The API does not require a type. */
    type?: string;
    target: string[];
    targetType?: string[];
    appliesTo: string[];
    data: DecoratorData;
    /** Hub-owned UTC ISO-8601 times. A decorator stored before Hub recorded them has none. */
    creationDateTime?: string;
    updateDateTime?: string;
}

export type ControlEvaluationStatus = 'met' | 'not-met' | 'not-applicable';

export interface ControlEvaluationFinding {
    subject: string;
    check?: string;
    description: string;
    expression?: string;
    cause?: string;
}

export interface ControlEvaluationDecoratorData extends DecoratorData {
    control: { 'unique-id': string; 'control-id'?: string; 'requirement-url': string; 'attached-to'?: string };
    status: ControlEvaluationStatus;
    'evaluated-at': string;
    change?: { commit: string; 'diff-sha256'?: string; spec?: string };
    findings?: ControlEvaluationFinding[];
    actors?: Record<string, string>;
    engine?: { name: string; version?: string; 'policy-sha256'?: string };
    'report-sha256'?: string;
    'report-uri'?: string;
}

export interface ControlEvaluationDecorator extends Decorator {
    type: 'control-evaluation';
    data: ControlEvaluationDecoratorData;
}

/** An element's latest evaluation per control, and the overall result shown on the diagram. */
export interface ElementEvaluation {
    status: 'met' | 'not-met';
    latest: ControlEvaluationDecorator[];
}
