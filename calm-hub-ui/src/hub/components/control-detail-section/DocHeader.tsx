import { ExternalLink } from './ExternalLink.js';
import { MetaChip } from './MetaChip.js';
import { isUrlString } from './control-doc-utils.js';

/**
 * The title / description / identity block lifted from the top of a control
 * requirement or configuration document. Renders nothing when the document
 * carries none of the recognised header keys. A distinct `name` alongside a
 * `title` (or `summary` alongside a `description`) is shown as a secondary line
 * so it is never dropped from the readable view.
 */
export function DocHeader({ doc }: { doc: Record<string, unknown> }) {
    const title = doc.title as string | undefined;
    const name = doc.name as string | undefined;
    const description = doc.description as string | undefined;
    const summary = doc.summary as string | undefined;
    const idValue = (doc.$id ?? doc.id) as string | undefined;
    const controlId = doc['control-id'] as string | undefined;
    const category = doc.category as string | undefined;
    const source = doc.source as string | undefined;
    const url = doc.url;

    const heading = title ?? name;
    const subheading = title && name && title !== name ? name : undefined;
    const body = description ?? summary;
    const secondaryBody =
        description && summary && description !== summary ? summary : undefined;

    const hasChip = idValue || controlId || category || source;
    if (!heading && !body && !subheading && !secondaryBody && !hasChip && !isUrlString(url)) {
        return null;
    }

    return (
        <div className="flex flex-col gap-1">
            {heading && <h3 className="text-base font-bold text-base-content">{heading}</h3>}
            {subheading && <p className="text-xs text-base-content/50">{subheading}</p>}
            {body && (
                <p className="text-sm text-base-content/70 leading-relaxed">{body}</p>
            )}
            {secondaryBody && (
                <p className="text-sm text-base-content/60 leading-relaxed">{secondaryBody}</p>
            )}
            {hasChip && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                    {idValue && <MetaChip label="id" value={idValue} />}
                    {controlId && <MetaChip label="control-id" value={controlId} />}
                    {category && <MetaChip label="category" value={category} />}
                    {source && <MetaChip label="source" value={source} />}
                </div>
            )}
            {isUrlString(url) && <ExternalLink href={url} />}
        </div>
    );
}
