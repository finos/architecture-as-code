export type DecoratorData = Record<string, unknown>;

export type DeploymentStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'rolled-back';

export interface DeploymentDecoratorData extends DecoratorData {
    'start-time': string;
    'end-time': string;
    status: DeploymentStatus;
    'deployment-details'?: string;
    notes?: string;
}

export interface Decorator<StandardType extends DecoratorData = DecoratorData> {
    schema?: string;
    uniqueId: string;
    type: string;
    target: string[];
    targetType?: string[];
    appliesTo: string[];
    data: StandardType;
}

export type DecoratorWithData<StandardType extends DecoratorData = DecoratorData> = Decorator<StandardType>;

export type DeploymentDecorator = DecoratorWithData<DeploymentDecoratorData>;

export interface DeploymentPanelProps {
    decorators: DeploymentDecorator[];
}
