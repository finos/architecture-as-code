/**
 * Represents a control detail returned from the API.
 */
export interface ControlDetail {
    id: number;
    name: string;
    description: string;
}

/**
 * Represents the data loaded when a user selects a control in the tree.
 */
export interface ControlData {
    domain: string;
    controlId: number;
    controlName: string;
    controlDescription: string;
}
