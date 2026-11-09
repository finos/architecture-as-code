export type ResourceType = 'patterns' | 'architectures' | 'flows' | 'standards' | 'interfaces' | 'timelines';
export const RESOURCE_TYPES = ['patterns', 'architectures', 'flows', 'standards', 'interfaces', 'timelines'];

export function isValidResourceType(input: string): input is ResourceType {
    return RESOURCE_TYPES.includes(input);
}
