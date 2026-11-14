import { ReactNode, useEffect, useState } from 'react';
import { ExtensionContext, ExtensionContribution, ExtensionScreen, ExtensionSummary } from '../model/extensions.js';
import { ExtensionActionButton } from './ExtensionActionButton.js';
import { Heading, HeadingLevel } from './Heading.js';
import { ScreenErrorBoundary } from './ScreenErrorBoundary.js';
import { BlockRenderer } from './blocks/BlockRenderer.js';
import { isBlocksReply } from './blocks/reply.js';
import { useExtensionService } from './ExtensionsContext.js';

interface SlotProps {
    extension: ExtensionSummary;
    contribution: ExtensionContribution;
    context?: ExtensionContext;
    /** The level of the slot title: one below the heading of the place that holds the slot. */
    headingLevel?: HeadingLevel;
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

function SlotContent({ extension, contribution, context = {}, action, headingLevel = 2, placement }: ExtensionSlotProps) {
    const service = useExtensionService();
    const route = extension.routes.find((entry) => entry.id === contribution.route);
    const [result, setResult] = useState<ExtensionScreen>();
    const [error, setError] = useState(false);
    const { namespace, resource, resourceType, resourceId, version, selectedElement } = context;
    useEffect(() => {
        if (action || !route) return;
        if (route.method !== 'GET') return;
        const controller = new AbortController();
        service
            .call(extension.id, route, { namespace, resource, resourceType, resourceId, version, selectedElement }, controller.signal)
            .then((reply) => {
                if (!isBlocksReply(reply, extension.hubApi)) throw new Error('Invalid blocks reply');
                if (!controller.signal.aborted) setResult(reply);
            })
            .catch(() => {
                if (!controller.signal.aborted) setError(true);
            });
        return () => controller.abort();
    }, [service, extension.id, extension.hubApi, route, action, namespace, resource, resourceType, resourceId, version, selectedElement]);
    if (action) {
        if (!route) return <p role="alert">Extension route unavailable.</p>;
        return <ExtensionActionButton service={service} extension={extension} contribution={contribution} route={route} context={context} placement={placement!} />;
    }
    // A slot keeps its heading in every state, so the outline does not change (on a screen page, it is the h1).
    const state = !route ? (
        <p role="alert">Extension route unavailable.</p>
    ) : error ? (
        <p role="alert">Extension request failed.</p>
    ) : route.method !== 'GET' ? (
        <p role="alert">Block routes must use GET.</p>
    ) : !result ? (
        <p role="status">Loading extension…</p>
    ) : undefined;
    return (
        <SlotFrame title={contribution.title} level={headingLevel}>
            {result?.title && result.title !== contribution.title && <p className="text-base-content/70">{result.title}</p>}
            {state ?? result?.blocks.map((block, index) => <BlockRenderer key={index} block={block} headingLevel={headingLevel} />)}
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
    const key = JSON.stringify([props.extension.id, props.contribution.id, props.action ? null : props.context]);
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
