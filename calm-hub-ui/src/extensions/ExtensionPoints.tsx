import { Link } from 'react-router-dom';
import { useExtensions } from './ExtensionsContext.js';
import { ExtensionContext, ExtensionPoint } from '../model/extensions.js';
import { extensionRequest } from '../service/extension-service.js';
import { ExtensionSlot } from './ExtensionSlot.js';

interface ExtensionPointsProps {
    point: Exclude<ExtensionPoint, 'screen' | 'designer-tab'>;
    context?: ExtensionContext;
    /** Where the action buttons are, so each keeps its own result. It must be the same across a remount. */
    placement: string;
}

/** Each contribution to `point`. An action whose path needs a value the context does not give is left out. */
export function ExtensionPoints({ point, context, placement }: ExtensionPointsProps) {
    const extensions = useExtensions();
    return extensions.flatMap((extension) =>
        (extension.contributes[point] ?? [])
            .filter((contribution) => {
                if (point !== 'action') return true;
                const route = extension.routes.find((entry) => entry.id === contribution.route);
                if (!route) return false;
                try {
                    extensionRequest(extension.id, route, context ?? {});
                    return true;
                } catch {
                    return false;
                }
            })
            .map((contribution) =>
                point === 'action' ? (
                    <ExtensionSlot
                        key={`${extension.id}/${contribution.id}`}
                        extension={extension}
                        contribution={contribution}
                        context={context}
                        action
                        placement={placement}
                    />
                ) : (
                    <ExtensionSlot key={`${extension.id}/${contribution.id}`} extension={extension} contribution={contribution} context={context} />
                )
            )
    );
}

export function ExtensionScreenLinks({ onNavigate }: { onNavigate?: () => void } = {}) {
    const extensions = useExtensions();
    return extensions.flatMap((extension) =>
        (extension.contributes.screen ?? []).map((contribution) => (
            <Link
                onClick={onNavigate}
                className="block px-4 py-3 hover:bg-base-200"
                key={`${extension.id}/${contribution.id}`}
                to={`/extensions/${encodeURIComponent(extension.id)}/${encodeURIComponent(contribution.id)}`}
            >
                {contribution.title}
            </Link>
        ))
    );
}
