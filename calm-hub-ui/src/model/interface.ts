/**
 * Represents an interface summary returned from the API.
 */
export interface InterfaceDetail {
    id: string;
    name: string;
    description: string;
    customId?: string;
}

/**
 * Represents the data loaded when a user selects an interface in the tree.
 */
export interface InterfaceData {
    namespace: string;
    interfaceId: string;
    interfaceName: string;
    interfaceDescription: string;
}
