/**
 * Counts payloads served by the CALM Hub backend for the browse rail and
 * namespace page.
 *
 * - `GET /api/calm/namespaces/counts` → `{ values: NamespaceCounts[] }`
 * - `GET /api/calm/domains/counts`    → `{ values: DomainControlCount[] }`
 */

/** Per-namespace, per-resource-type counts. `total` is the sum of the six types. */
export interface NamespaceCounts {
    namespace: string;
    architectures: number;
    patterns: number;
    flows: number;
    standards: number;
    adrs: number;
    interfaces: number;
    total: number;
}

/** Per-domain control count. */
export interface DomainControlCount {
    domain: string;
    controlCount: number;
}
