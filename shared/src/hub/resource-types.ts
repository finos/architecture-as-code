export type ResourceType = 'patterns' | 'architectures' | 'flows' | 'standards' | 'interfaces';
export const RESOURCE_TYPES = ['patterns', 'architectures', 'flows', 'standards', 'interfaces'];

export function isValidResourceType(input: string): input is ResourceType {
    return RESOURCE_TYPES.includes(input);
}
