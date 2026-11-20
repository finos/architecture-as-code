export type ResourceType = 'patterns' | 'architectures' | 'flows' | 'standards' | 'interfaces' | 'timelines' | 'adrs';
export const RESOURCE_TYPES = ['patterns', 'architectures', 'flows', 'standards', 'interfaces', 'timelines', 'adrs'];

/** ADR versions are integer revisions that CALM Hub assigns. Other types use semver versions that the author chooses. */
export function hasIntegerRevisions(type: ResourceType): boolean {
    return type === 'adrs';
}

export function isValidResourceType(input: string): input is ResourceType {
    return RESOURCE_TYPES.includes(input);
}
