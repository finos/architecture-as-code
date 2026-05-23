import type { CalmTimelineSchema } from '@finos/calm-models/types';
import type { TimelineMoment } from './TimelineBar.js';

/**
 * Derive the underlying resource version from a moment's
 * `details.detailed-architecture` reference by parsing the trailing
 * `/versions/{version}` segment. Returns undefined when the reference is absent
 * or has no version segment.
 */
export function versionFromReference(reference: string | undefined): string | undefined {
    if (!reference) return undefined;
    const match = reference.match(/\/versions\/([^/?#]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Build timeline-bar moments from an architecture timeline document. The
 * timeline is already in chronological order (oldest first), so moments are
 * returned in document order. Moments whose reference yields no version are
 * dropped, since they cannot be navigated to or compared.
 */
export function momentsFromTimeline(timeline: CalmTimelineSchema): TimelineMoment[] {
    const moments = Array.isArray(timeline.moments) ? timeline.moments : [];
    return moments
        .map((moment) => {
            const version = versionFromReference(moment.details?.['detailed-architecture']);
            if (!version) return null;
            return {
                key: moment['unique-id'],
                label: moment.name || moment['unique-id'],
                version,
                validFrom: moment['valid-from'],
                adrs: Array.isArray(moment.adrs) ? moment.adrs : undefined,
            } satisfies TimelineMoment;
        })
        .filter((m): m is TimelineMoment => m !== null);
}

/**
 * Build timeline-bar moments from a pattern's version list. The list is
 * newest-first; moments are returned oldest-first so the bar reads left (old)
 * to right (new). Each version is a moment labelled by its version string.
 */
export function momentsFromVersions(versions: string[]): TimelineMoment[] {
    return [...versions].reverse().map((version) => ({
        key: version,
        label: version,
        version,
    }));
}

/** The timeline document's `current-moment` field, if any. */
export function currentMomentIdFromTimeline(timeline: CalmTimelineSchema): string | undefined {
    const id = timeline['current-moment'];
    return typeof id === 'string' && id.length > 0 ? id : undefined;
}

/**
 * Heuristic: a timeline counts as "explicit" (authored / stored) when any
 * moment carries metadata that the implied backend projection never sets —
 * specifically a `valid-from` date or any `adrs` references. Used to decide
 * whether to show a NOW badge: implied projections have an arbitrary
 * "current-moment" (the highest version) which doesn't reflect a real authored
 * "now", so the badge is omitted there.
 */
export function isExplicitTimeline(timeline: CalmTimelineSchema): boolean {
    const moments = Array.isArray(timeline.moments) ? timeline.moments : [];
    return moments.some(
        (m) => !!m['valid-from'] || (Array.isArray(m.adrs) && m.adrs.length > 0)
    );
}
