import { IoCodeOutline, IoEyeOutline, IoLayersOutline } from 'react-icons/io5';
import type { ExtensionsStatus } from '../../../../extensions/ExtensionsContext.js';
import { DiagramLensView } from '../../../../extensions/lens/DiagramLensView.js';
import type { ExtensionSummary } from '../../../../model/extensions.js';
import type { DiagramLensContribution } from '../../../../model/lens.js';
import { JsonRenderer } from '../../json-renderer/JsonRenderer.js';
import { extensionContext } from './diagramTabs.js';
import { DEFAULT_DIAGRAM_LENS_ID, JSON_LENS_ID, type DiagramLens } from './diagramTabRegistry.js';

export { JSON_LENS_ID } from './diagramTabRegistry.js';

/** The lenses that ship with Hub, in display order. The first is the CALM diagram. */
export const HUB_LENSES: readonly DiagramLens[] = [
    {
        id: DEFAULT_DIAGRAM_LENS_ID,
        label: 'CALM',
        title: 'The CALM diagram',
        icon: IoEyeOutline,
        render: ({ diagram }) => diagram,
    },
    {
        id: JSON_LENS_ID,
        label: 'JSON',
        title: 'The CALM JSON of this version',
        icon: IoCodeOutline,
        render: ({ data }) => (
            <div className="h-full bg-base-200 overflow-auto">
                <JsonRenderer json={data} />
            </div>
        ),
    },
];

const isLensEntry = (value: unknown): value is DiagramLensContribution =>
    typeof value === 'object' && value !== null
    && typeof (value as DiagramLensContribution).id === 'string' && typeof (value as DiagramLensContribution).title === 'string'
    && typeof (value as DiagramLensContribution).route === 'string';

const appliesTo = (lens: DiagramLensContribution, isArchitecture: boolean) =>
    (lens.appliesTo?.resourceTypes ?? ['architectures', 'patterns']).includes(isArchitecture ? 'architectures' : 'patterns');

/**
 * The lens of an extension. Hub draws its graph reply with its notation (`DiagramLensView`), so no extension code
 * runs in the browser. Its view parameters are the `params` of the manifest, which Hub keeps in the URL.
 */
function extensionLens(extension: ExtensionSummary, lens: DiagramLensContribution): DiagramLens {
    return {
        id: lens.id,
        label: lens.title,
        title: lens.description,
        icon: IoLayersOutline,
        extension: { id: extension.id, name: extension.name || extension.id },
        isVisible: ({ isArchitecture }) => appliesTo(lens, isArchitecture),
        searchParams: Object.keys(lens.params ?? {}),
        render: ({ data, selectedElement, searchParams, setTabParams, selectElement }) => (
            <DiagramLensView
                key={`${extension.id}/${lens.id}`}
                extension={extension}
                lens={lens}
                context={extensionContext(data, selectedElement)}
                params={Object.fromEntries(Object.keys(lens.params ?? {}).map((name) => [name, searchParams.get(name) ?? undefined]))}
                onParamsChange={setTabParams}
                onSelectElement={(uniqueId) => selectElement?.(uniqueId)}
            />
        ),
    };
}

/**
 * The lenses of the Diagram tab: Hub's own, then the `diagram-lens` entries of the enabled extensions in registry
 * order. Hub refuses two lenses with one id, and an id of its own, so `?lens=<id>` names one lens. Until the registry
 * loads, and if it does not load, only Hub's own lenses.
 */
export function diagramLenses(extensions: readonly ExtensionSummary[], status: ExtensionsStatus): readonly DiagramLens[] {
    if (status !== 'loaded') return HUB_LENSES;
    const ids = new Set(HUB_LENSES.map((lens) => lens.id));
    const lenses = extensions.flatMap((extension) => {
        const entries: unknown = extension.contributes['diagram-lens'];
        if (!Array.isArray(entries)) return [];
        return entries.filter(isLensEntry).filter((entry) => !ids.has(entry.id) && !!ids.add(entry.id))
            .map((entry) => extensionLens(extension, entry));
    });
    return [...HUB_LENSES, ...lenses];
}
