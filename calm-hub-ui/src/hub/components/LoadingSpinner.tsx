/**
 * Shared spinner markup for the drill-down/browse navigation surfaces
 * (ExploreRail, MobileNavMenu). Callers own their own wrapper element and
 * spacing (a rail `<div>` vs a mobile `<li>`), since those differ by context —
 * only the spinner itself needs to stay identical between them.
 */
export function LoadingSpinner({ label }: { label: string }) {
    return <span role="status" aria-label={label} className="loading loading-spinner loading-md text-base-content/50" />;
}
