export interface CurieComponents {
    namespace: string;
    type: string;
    slug: string;
    version?: string;
}

export function isCurie(ref: string): boolean {
    // A CURIE has exactly 2 colons separating 3 segments, no slashes before the first colon
    // Pattern: word:word:word (optionally word:word:word@sha)
    const parts = ref.split(':');
    if (parts.length !== 3) return false;
    // First segment (namespace) must not contain slashes or dots (distinguishes from URLs)
    return !parts[0].includes('/') && !parts[0].includes('.');
}

export function parseCurie(curie: string): CurieComponents | null {
    if (!isCurie(curie)) return null;
    const [namespace, type, slugAndVersion] = curie.split(':');
    const atIndex = slugAndVersion.indexOf('@');
    if (atIndex === -1) {
        return { namespace, type, slug: slugAndVersion };
    }
    return {
        namespace,
        type,
        slug: slugAndVersion.substring(0, atIndex),
        version: slugAndVersion.substring(atIndex + 1),
    };
}

export function expandCurie(curie: string, hubBaseUrl: string): string {
    const components = parseCurie(curie);
    if (!components) return curie; // Not a CURIE, return as-is
    const base = `${hubBaseUrl}/calm/namespaces/${components.namespace}/${components.type}/${components.slug}`;
    if (components.version) {
        return `${base}/versions/${components.version}`;
    }
    return base;
}
