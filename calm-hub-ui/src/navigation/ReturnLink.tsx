import { Link, useLocation } from 'react-router-dom';
import { IoArrowBackOutline } from 'react-icons/io5';
import { readReturnPoints, returnPointLocation } from './returnPoints.js';

/**
 * "Back to <label>": the page that the user came from, with its query as it was, such as table filters or a selected
 * node. It takes that point off the return points. Nothing shows without one, for example on a copied link.
 */
export function ReturnLink({ className = '' }: { className?: string }) {
    const { state } = useLocation();
    const points = readReturnPoints(state);
    const target = points.at(-1);
    if (!target) return null;
    const earlier = points.slice(0, -1);
    return (
        <Link
            to={returnPointLocation(target)}
            state={earlier.length > 0 ? { returnTo: earlier } : undefined}
            className={`link link-primary no-underline inline-flex items-center gap-1 min-w-0 text-sm ${className}`}
            title={`Back to ${target.label}`}
        >
            <IoArrowBackOutline aria-hidden="true" className="shrink-0" />
            <span className="truncate">Back to {target.label}</span>
        </Link>
    );
}
