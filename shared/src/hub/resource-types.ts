export type ResourceType = 'patterns' | 'architectures' | 'standards' | 'interfaces';
export const RESOURCE_TYPES = ['patterns', 'architectures', 'standards', 'interfaces'];

export function isValidResourceType(input: string): input is ResourceType {
    return RESOURCE_TYPES.includes(input);
}
