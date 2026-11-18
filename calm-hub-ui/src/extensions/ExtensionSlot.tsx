import { ReactNode, useId, useMemo } from 'react';
import { ExtensionContext, ExtensionContribution, ExtensionSummary } from '../model/extensions.js';
import type { FormPoint } from './forms/FormBlock.js';
import { ExtensionActionButton } from './ExtensionActionButton.js';
import { Heading, HeadingLevel } from './Heading.js';
import { ScreenErrorBoundary } from './ScreenErrorBoundary.js';
import { BlockRenderer } from './blocks/BlockRenderer.js';
import { BlockScope, BlockScopeContext, useScopeTables, useTableStateStore } from './blocks/BlockScope.js';
import { isBlocksReply } from './blocks/reply.js';
import { useExtensionService } from './ExtensionsContext.js';
import { useExtensionRevision } from './extensionRefresh.js';
import { RetryAlert } from './RetryAlert.js';
import { useRefreshingRequest } from './useRefreshingRequest.js';

interface SlotProps {
    extension: ExtensionSummary;
    contribution: ExtensionContribution;
    context?: ExtensionContext;
    /** View parameters of a screen, sent with the context. A change loads the slot again. */
    query?: Readonly<Record<string, string>>;
    /** The level of the slot title: one below the heading of the place that holds the slot. */
    headingLevel?: HeadingLevel;
    /** The extension point of a block slot. A form block shows only in a slot that names it, which keys its draft. */
    point?: FormPoint;
}

export type ExtensionSlotProps =
    | (SlotProps & { action?: false; placement?: never })
    | (SlotProps & {
          action: true;
          /**
           * Where the button is, so each button keeps its own result. Required, so that two places cannot share a
           * default. It must be the same across a remount.
           */
          placement: string;
      });

function SlotContent({ extension, contribution, context = {}, query, action, headingLevel = 2, placement, point }: ExtensionSlotProps) {
    const service = useExtensionService();
    const revision = useExtensionRevision(extension.id);
    const domId = useId();
    const route = extension.routes.find((entry) => entry.id === contribution.route);
    const { namespace, resource, resourceType, resourceId, version, selectedElement } = context;
    // A string, so a new object with the same values does not load the slot again.
    const queryKey = JSON.stringify(query ?? {});
    const view = JSON.stringify([namespace, resource, resourceType, resourceId, version, selectedElement, queryKey]);
    // Filters belong to the data of one context, so another context starts without them.
    const tableState = useTableStateStore(view);
    const load = useMemo(() => {
        if (action || !route || route.method !== 'GET') return undefined;
        const params = JSON.parse(queryKey) as Record<string, string>;
        return (signal: AbortSignal) =>
            service
                .call(extension.id, route, { ...params, namespace, resource, resourceType, resourceId, version, selectedElement }, signal)
                .then((reply) => {
                    if (!isBlocksReply(reply, extension.hubApi)) throw new Error('Invalid blocks reply');
                    return reply;
                });
    }, [service, extension.id, extension.hubApi, route, action, queryKey, namespace, resource, resourceType, resourceId, version, selectedElement]);
    // A confirmed write raises the revision: the slot loads again in place, and its tables keep their filters.
    const { value: result, loading, failed, retrying, retry } = useRefreshingRequest(view, revision, load);
    const tables = useScopeTables(result?.blocks);
    const scope = useMemo<BlockScope | undefined>(
        () =>
            result && {
                extension,
                context: { namespace, resource, resourceType, resourceId, version, selectedElement },
                blocks: result.blocks,
                tables,
                domId,
                state: tableState,
            },
        [result, extension, namespace, resource, resourceType, resourceId, version, selectedElement, tables, domId, tableState]
    );
    if (action) {
        if (!route) return <p role="alert">Extension route unavailable.</p>;
        return (
            <ExtensionActionButton
                service={service}
                extension={extension}
                contribution={contribution}
                route={route}
                context={context}
                placement={placement!}
            />
        );
    }
    // A slot keeps its heading in every state, so the outline does not change (on a screen page, it is the h1).
    const state = !route ? (
        <p role="alert">Extension route unavailable.</p>
    ) : route.method !== 'GET' ? (
        <p role="alert">Block routes must use GET.</p>
    ) : !result && failed ? (
        <p role="alert">Extension request failed.</p>
    ) : !result ? (
        <p role="status">Loading extension…</p>
    ) : undefined;
    return (
        <SlotFrame title={contribution.title} level={headingLevel}>
            {result?.title && result.title !== contribution.title && <p className="text-base-content/70">{result.title}</p>}
            {result && (failed || retrying) && (
                <RetryAlert message="Could not refresh. This shows the data from before." retrying={retrying} onRetry={retry} />
            )}
            {result && (
                <p role="status" className="sr-only">
                    {loading && !retrying ? 'Refreshing…' : ''}
                </p>
            )}
            {state ?? (
                <BlockScopeContext.Provider value={scope ?? null}>
                    {result?.blocks.map((block, index) => (
                        // A table with filters keeps its search box, and text not sent yet, when a reply moves it.
                        <BlockRenderer
                            key={block?.type === 'table' && tables.get(block.id ?? '') === block ? `table ${block.id}` : index}
                            block={block}
                            headingLevel={headingLevel}
                            formSlot={point && { extension, point, contributionId: contribution.id, context }}
                        />
                    ))}
                </BlockScopeContext.Provider>
            )}
        </SlotFrame>
    );
}

/**
 * The named region of a slot. Its heading is the region name in every state, so a reply or a failure does not change
 * the outline. A reply `title` shows under it.
 */
export function SlotFrame({ title, level, children }: { title: string; level: HeadingLevel; children: ReactNode }) {
    return (
        <section className="@container flex flex-col gap-4 min-w-0 overflow-auto" aria-label={title}>
            <Heading level={level} className="text-lg font-bold">
                {title}
            </Heading>
            {children}
        </section>
    );
}

export function ExtensionSlot(props: ExtensionSlotProps) {
    // An action keeps its state when the context changes, so a change of selection does not reset a running write.
    const key = JSON.stringify([props.extension.id, props.contribution.id, props.action ? null : [props.context, props.query]]);
    return (
        <ScreenErrorBoundary
            key={key}
            frame={
                props.action
                    ? undefined
                    : (content) => (
                          <SlotFrame title={props.contribution.title} level={props.headingLevel ?? 2}>
                              {content}
                          </SlotFrame>
                      )
            }
        >
            <SlotContent key={key} {...props} />
        </ScreenErrorBoundary>
    );
}
