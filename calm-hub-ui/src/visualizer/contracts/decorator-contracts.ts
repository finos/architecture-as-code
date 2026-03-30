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
