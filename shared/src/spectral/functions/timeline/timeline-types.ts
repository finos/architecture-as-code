/**
 * Minimal shape of a timeline document as seen by the timeline Spectral functions.
 * The properties are intentionally `unknown` because the value comes from
 * unvalidated JSON and is narrowed at the point of use.
 */
export interface TimelineInput {
    moments?: unknown;
    'current-moment'?: unknown;
}
