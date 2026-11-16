import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ExtensionContext, ExtensionSummary } from '../../model/extensions.js';
import type { DiagramLensContribution, LensNode, LensReply } from '../../model/lens.js';
import { resourcePath } from '../../hub/routes.js';
import { ExtensionCallError } from '../../service/extension-service.js';
import { useResolvedTheme } from '../../theme/useTheme.js';
import { useExtensionService } from '../ExtensionsContext.js';
import { ScreenErrorBoundary } from '../ScreenErrorBoundary.js';
import { safeHref } from '../ScreenLink.js';
import { BlockRenderer } from '../blocks/BlockRenderer.js';
import { resetElk, sharedElk } from './elk.js';
import { LayoutTimeout, layoutLens, type Layout } from './layout.js';
import { LensCanvas } from './LensCanvas.js';
import { LensKey } from './LensKey.js';
import { LensToolbar } from './LensToolbar.js';
import { isParamsLinkAllowed, lensParams, parseLensReply } from './reply.js';
import { keyEntries, type ResolvedNotation } from './styles.js';

export interface DiagramLensViewProps {
    extension: ExtensionSummary;
    lens: DiagramLensContribution;
    context: ExtensionContext;
    /** The view parameters in the URL. Only the ones that the lens declares reach its route. */
    params: Record<string, string | undefined>;
    onParamsChange: (params: Record<string, string>) => void;
    onSelectElement: (uniqueId: string) => void;
}

type Fetched =
    | { status: 'loading' }
    | { status: 'error'; message: string; detail?: string }
    | { status: 'fetched'; reply: LensReply; notation: ResolvedNotation };

type Ready = { status: 'ready'; reply: LensReply; notation: ResolvedNotation; layout: Layout };
type LaidOut = (Ready | { status: 'error'; message: string; detail?: string }) & { source: Fetched };
type State = Exclude<Fetched, { status: 'fetched' }> | Ready;

/**
 * A diagram lens of an extension. Its route returns a graph, and Hub lays it out and draws it with the notation of
 * the lens. No extension code or markup runs: Hub builds each element from the data.
 */
export function DiagramLensView({ extension, lens, context, params, onParamsChange, onSelectElement }: DiagramLensViewProps) {
    const service = useExtensionService();
    const theme = useResolvedTheme();
    const navigate = useNavigate();
    const [fetched, setFetched] = useState<Fetched>({ status: 'loading' });
    const [laidOut, setLaidOut] = useState<LaidOut>();
    const [hiddenTags, setHiddenTags] = useState<ReadonlySet<string>>(new Set());
    const [panelsOpen, setPanelsOpen] = useState(true);
    const route = extension.routes.find((entry) => entry.id === lens.route);
    const values = useMemo(() => lensParams(lens, params), [lens, params]);
    const { namespace, resource, resourceType, resourceId, version, selectedElement } = context;
    // A selection draws from the calm ids with no request, so the route gets it only when its path needs it.
    const needsSelection = !!route?.path.includes('{selectedElement}');
    const requestKey = JSON.stringify({
        namespace, resource, resourceType, resourceId, version, ...(needsSelection && { selectedElement }), ...values,
    });

    useEffect(() => {
        if (!route) return;
        const controller = new AbortController();
        const notation = Promise.all([service.fetchLensNotation(extension.id, lens.id, controller.signal), service.fetchCoreNotation()])
            .then(([own, core]) => ({ own, core }));
        Promise.all([notation, service.call(extension.id, route, JSON.parse(requestKey), controller.signal)])
            .then(([resolved, value]) => {
                const parsed = parseLensReply(value, extension.hubApi, lens);
                if (!parsed.reply) throw new LensProblem(parsed.problem);
                if (!controller.signal.aborted) setFetched({ status: 'fetched', reply: parsed.reply, notation: resolved });
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) setFetched(errorState(error));
            });
        return () => controller.abort();
    }, [service, extension.id, extension.hubApi, lens, route, requestKey]);

    // The theme changes the colours only, so a change of theme lays out again with no request.
    useEffect(() => {
        if (fetched.status !== 'fetched') return;
        let current = true;
        layoutLens(fetched.reply, fetched.notation, theme, sharedElk)
            .then((layout) => {
                if (current) setLaidOut({ status: 'ready', reply: fetched.reply, notation: fetched.notation, layout, source: fetched });
            })
            .catch((error: unknown) => {
                if (error instanceof LayoutTimeout) resetElk();
                if (current) setLaidOut({ ...errorState(error), source: fetched });
            });
        return () => {
            current = false;
        };
    }, [fetched, theme]);

    // While a new reply lays out, the last diagram stays, so a drill-down does not flash a loading message.
    const state = useMemo<State>(() => !route
        ? { status: 'error', message: 'The lens names a route that the extension does not have.' }
        : fetched.status !== 'fetched'
          ? fetched
          : laidOut && (laidOut.source === fetched || laidOut.status === 'ready')
            ? laidOut
            : { status: 'loading' }, [route, fetched, laidOut]);

    const entries = useMemo(() => {
        if (state.status !== 'ready') return [];
        const { graph } = state.reply;
        return keyEntries(state.notation, new Set(graph.nodes.flatMap((node) => node.tags ?? [])), new Set(graph.edges.flatMap((edge) => edge.tags ?? [])));
    }, [state]);

    const setParam = (param: string, value: string) => onParamsChange({ ...values, [param]: value });
    const activate = (node: LensNode) => {
        if (node.calm?.[0]) onSelectElement(node.calm[0]);
        const link = node.link;
        if (link?.params && isParamsLinkAllowed(lens, link.params)) onParamsChange({ ...values, ...link.params });
        else if (link?.hub?.version) navigate(resourcePath({ ...link.hub, version: link.hub.version }));
        else if (link?.href) {
            const href = safeHref(link.href);
            if (href?.startsWith('https://')) window.open(href, '_blank', 'noopener,noreferrer');
        }
    };
    const toggleTag = (tag: string) =>
        setHiddenTags((current) => {
            const next = new Set(current);
            if (!next.delete(tag)) next.add(tag);
            return next;
        });

    return (
        <section className="flex h-full min-h-0 flex-col" aria-label={lens.title} data-lens={`${extension.id}/${lens.id}`}>
            {state.status === 'ready' && (state.reply.controls.length > 0 || state.reply.title) && (
                <div className="flex flex-wrap items-center gap-3 border-b border-base-300 px-3 py-2">
                    {state.reply.title && <h3 className="text-sm font-semibold">{state.reply.title}</h3>}
                    <LensToolbar controls={state.reply.controls} values={values} onChange={setParam} />
                    {state.reply.panels.length > 0 && !panelsOpen && (
                        <button type="button" className="btn btn-ghost btn-xs ml-auto" onClick={() => setPanelsOpen(true)}>
                            Show notes
                        </button>
                    )}
                </div>
            )}
            {/* Below 1024 pixels the notes go under the diagram, so a phone keeps the width for the diagram. */}
            <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
                {state.status === 'loading' && <p role="status" className="m-auto text-sm text-base-content/60">Loading {lens.title}…</p>}
                {state.status === 'error' && (
                    <div role="alert" className="m-auto max-w-md text-center text-sm">
                        <p className="font-semibold">{state.message}</p>
                        {state.detail && <p className="mt-1 text-base-content/70">{state.detail}</p>}
                    </div>
                )}
                {state.status === 'ready' && (
                    <>
                        <div className="relative min-h-0 min-w-0 flex-1">
                            <LensCanvas layout={state.layout} notation={state.notation} theme={theme} selectedElement={selectedElement}
                                hiddenTags={hiddenTags} onActivateNode={activate} onSelect={(calm) => onSelectElement(calm[0])} />
                            <LensKey entries={entries} notation={state.notation} theme={theme} hidden={hiddenTags} onToggle={toggleTag} />
                        </div>
                        {panelsOpen && state.reply.panels.length > 0 && (
                            <aside className="flex max-h-[40%] shrink-0 flex-col gap-4 overflow-auto border-t border-base-300 p-3 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0" aria-label="Lens notes">
                                <button type="button" className="btn btn-ghost btn-xs self-end" onClick={() => setPanelsOpen(false)}>
                                    Hide
                                </button>
                                {state.reply.panels.map((panel, index) => (
                                    <section key={index} aria-label={panel.title} className="flex flex-col gap-2">
                                        <h4 className="text-sm font-semibold">{panel.title}</h4>
                                        <ScreenErrorBoundary>
                                            {panel.blocks.map((block, at) => <BlockRenderer key={at} block={block} headingLevel={4} />)}
                                        </ScreenErrorBoundary>
                                    </section>
                                ))}
                            </aside>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}

class LensProblem extends Error {}

function errorState(error: unknown): Exclude<Fetched, { status: 'fetched' | 'loading' }> {
    if (error instanceof LensProblem) return { status: 'error', message: 'The lens reply is not valid.', detail: error.message };
    if (error instanceof LayoutTimeout) return { status: 'error', message: 'The diagram is too large to lay out.', detail: error.message };
    if (error instanceof ExtensionCallError && error.problem) {
        return { status: 'error', message: error.problem.title ?? 'The lens request failed.', detail: error.problem.detail };
    }
    return { status: 'error', message: 'The lens request failed.' };
}
