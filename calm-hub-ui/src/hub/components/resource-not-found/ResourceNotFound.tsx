import { useNavigate } from 'react-router-dom';
import { IoArrowBackOutline, IoAlertCircleOutline, IoHomeOutline } from 'react-icons/io5';
import { BreadcrumbItem } from '../../../model/calm.js';

interface ResourceNotFoundProps {
    /** The route segments that failed to load, echoed back so the user sees what was requested. */
    namespace: string;
    id: string;
    version: string;
    /**
     * The route resource type (`architectures` | `patterns`); drives the heading noun.
     * Any other/absent value falls back to the neutral "Resource".
     */
    type?: string;
    /** Breadcrumb trail from history state; when present the primary action returns to the last crumb. */
    breadcrumbs?: BreadcrumbItem[];
}

/** Human-readable, singular noun for the not-found heading, derived from the route type. */
function resourceNoun(type: string | undefined): string {
    switch (type) {
        case 'architectures':
            return 'Architecture';
        case 'patterns':
            return 'Pattern';
        default:
            return 'Resource';
    }
}

/**
 * Inline not-found state for the item-detail route, shown when the routed
 * resource fails to load (dangling detailed-architecture reference, stale deep
 * link, deleted resource). Rendered in place of the blank detail pane so the
 * user always has a recovery path: back to the parent architecture when a
 * breadcrumb trail exists (in-app navigation), otherwise back to the hub root.
 */
export function ResourceNotFound({ namespace, id, version, type, breadcrumbs }: ResourceNotFoundProps) {
    const navigate = useNavigate();
    const parent = breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : undefined;

    const goToParent = () => {
        if (!parent) return;
        // Mirror SectionHeader's breadcrumb click: the trail on the parent entry
        // excludes the parent itself.
        navigate(`/${parent.namespace}/${parent.type}/${parent.id}/${parent.version}`, {
            state: { breadcrumbs: breadcrumbs!.slice(0, -1) },
        });
    };

    return (
        <div className="flex items-center justify-center h-full bg-base-200 p-6">
            <div className="bg-base-100 rounded-box shadow-xl p-8 max-w-md text-center flex flex-col items-center gap-3">
                <IoAlertCircleOutline size={40} className="text-warning" aria-hidden="true" />
                <h2 className="text-lg font-semibold">{resourceNoun(type)} not found</h2>
                <p className="text-sm text-base-content/70">
                    <span className="font-mono break-all">
                        {namespace}/{id}@{version}
                    </span>{' '}
                    could not be loaded. It may not exist yet, or the reference pointing here may be out of
                    date.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                    {parent && (
                        <button className="btn btn-primary btn-sm" onClick={goToParent}>
                            <IoArrowBackOutline aria-hidden="true" />
                            Back to {parent.name || parent.id}
                        </button>
                    )}
                    <button className={`btn btn-sm ${parent ? 'btn-ghost' : 'btn-primary'}`} onClick={() => navigate('/')}>
                        <IoHomeOutline aria-hidden="true" />
                        Browse the hub
                    </button>
                </div>
            </div>
        </div>
    );
}
