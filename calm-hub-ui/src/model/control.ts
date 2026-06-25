export interface ControlDetail {
    id: number;
    name: string;
    description: string;
    title?: string;
}

export interface ControlConfigDetail {
    id: number;
    name?: string;
    title?: string;
}

export interface ControlData {
    domain: string;
    controlId: number;
    controlName: string;
    controlDescription: string;
}
