export interface CurieComponents {
    namespace: string;
    type: string;
    slug: string;
    version?: string;
}

// namespace:type:slug[@version], using the segment rules that CALM Hub enforces
const CURIE_PATTERN = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*:[A-Za-z0-9-]+:[A-Za-z][A-Za-z0-9]*(-[A-Za-z0-9]+)*(@[A-Za-z0-9.-]+)?$/;

export function isCurie(ref: string): boolean {
    return CURIE_PATTERN.test(ref);
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
    if (!components) return curie;
    const base = hubBaseUrl.replace(/\/+$/, '');
    if (!components.version) {
        throw new Error(`CURIE '${curie}' requires a version for Hub resolution (e.g. ${curie}@1.0.0)`);
    }
    return `${base}/calm/namespaces/${components.namespace}/${components.type}/${components.slug}/versions/${components.version}`;
}
