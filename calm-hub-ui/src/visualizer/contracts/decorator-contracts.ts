export interface Decorator {
    schema?: string;
    uniqueId?: string;
    type?: string;
    target?: string[];
    targetType?: string[];
    appliesTo?: string[];
    data?: unknown;
}

export interface DeploymentPanelProps {
    decorators: Decorator[];
}
