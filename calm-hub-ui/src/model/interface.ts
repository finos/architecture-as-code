/**
 * Represents an interface summary returned from the API.
 */
export interface InterfaceDetail {
    id: number;
    name: string;
    description: string;
}

/**
 * Represents the data loaded when a user selects an interface in the tree.
 */
export interface InterfaceData {
    namespace: string;
    interfaceId: number;
    interfaceName: string;
    interfaceDescription: string;
}
