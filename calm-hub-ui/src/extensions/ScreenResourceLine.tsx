import type { ResourceTarget } from '../model/extensions.js';
import { DestinationLink } from '../navigation/DestinationLink.js';

/** The resource that a screen shows, from its link, with a link to open that resource and element in Hub. */
export function ScreenResourceLine({ target }: { target: ResourceTarget }) {
    const { namespace, type, id, version, element } = target;
    return (
        <p className="text-sm text-base-content/70 wrap-anywhere">
            For{' '}
            <DestinationLink destination={{ hub: target }} className="link link-primary no-underline font-mono">
                {namespace}/{type}/{id}@{version}
            </DestinationLink>
            {element !== undefined && (
                <>
                    , element <span className="font-mono">{element}</span>
                </>
            )}
        </p>
    );
}
