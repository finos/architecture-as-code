export type DecoratorData = Record<string, unknown>;

export type DeploymentStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'rolled-back';

export interface DeploymentDecoratorData extends DecoratorData {
    'start-time': string;
    'end-time'?: string;
    status: DeploymentStatus;
    'deployment-details'?: string;
    notes?: string;
}

export interface Decorator {
    schema: string;
    uniqueId: string;
    type: string;
    target: string[];
    targetType?: string[];
    appliesTo: string[];
    data: DecoratorData;
}

export interface DeploymentDecorator extends Decorator {
    type: 'deployment';
    data: DeploymentDecoratorData;
}

export interface DeploymentPanelProps {
    decorators: DeploymentDecorator[];
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
