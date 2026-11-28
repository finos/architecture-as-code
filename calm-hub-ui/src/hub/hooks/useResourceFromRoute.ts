import { useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CalmService } from '../../service/calm-service.js';
import { ControlService } from '../../service/control-service.js';
import { InterfaceService } from '../../service/interface-service.js';
import { AdrService } from '../../service/adr-service/adr-service.js';
import { Data, Adr, isSlug } from '../../model/calm.js';
import { ControlData } from '../../model/control.js';
import { InterfaceData } from '../../model/interface.js';
import {
    type TypeInUrl,
    mapTypeInUrlToTypeInUI,
    loadResource,
    loadResourceForId,
} from '../components/tree-navigation/navigation-loaders.js';

type HubParams = {
    namespace: string;
    type: TypeInUrl;
    id: string;
    version: string;
};

interface UseResourceFromRouteOptions {
    /** From useResourceNavigationKey. The resource loads again each time this key changes. */
    resourceKey: string;
    onDataLoad: (data: Data) => void;
    onAdrLoad: (adr: Adr) => void;
    onControlLoad: (control: ControlData) => void;
    onInterfaceLoad: (iface: InterfaceData) => void;
    /**
     * Invoked when the routed resource fails to load (e.g. a deep link or a
     * detailed-architecture reference to a resource that does not exist), so the
     * page can show a not-found state instead of an empty pane. Never invoked
     * for a load started for a previous route. Expected stable (memoised).
     */
    onLoadError?: (error: unknown) => void;
}

/**
 * Deep-link / external-navigation loading for the item-detail route
 * (`/:namespace/:type/:id/:version`). Previously lived inside both
 * `TreeNavigation` (desktop) and `MobileNavMenu` (mobile); lifted here so it
 * runs from {@link Hub} directly on both viewports, independent of which
 * navigation surface is mounted. There must be exactly one owner of this effect.
 *
 * `onControlLoad`/`onInterfaceLoad` are read through refs (not effect deps) so
 * passing fresh callbacks does not re-fire the load; `onDataLoad`/`onAdrLoad`
 * are expected to be stable (memoised by the caller).
 */
export function useResourceFromRoute({
    resourceKey,
    onDataLoad,
    onAdrLoad,
    onControlLoad,
    onInterfaceLoad,
    onLoadError,
}: UseResourceFromRouteOptions) {
    const { namespace, type, id, version } = useParams<HubParams>();
    const [searchParams] = useSearchParams();
    const controlPath = searchParams.get('path') ?? '';
    const controlVariant = searchParams.get('variant') ?? '';
    const hasControlIdentity = searchParams.has('path') || searchParams.has('variant');

    const onControlLoadRef = useRef(onControlLoad);
    const onInterfaceLoadRef = useRef(onInterfaceLoad);
    // Declared before the load effect, so the refs are current when it runs.
    useEffect(() => {
        onControlLoadRef.current = onControlLoad;
        onInterfaceLoadRef.current = onInterfaceLoad;
    });

    const calmService = useMemo(() => new CalmService(), []);
    const controlService = useMemo(() => new ControlService(), []);
    const interfaceService = useMemo(() => new InterfaceService(), []);
    const adrService = useMemo(() => new AdrService(), []);

    useEffect(() => {
        if (!(namespace && type && id && version)) return;
        const uiType = mapTypeInUrlToTypeInUI(type);

        // The loaders have no cancellation, so a promise can settle after the user
        // has already navigated on. Guard every callback behind `cancelled` (flipped
        // by the cleanup) so a stale result from a previous route neither renders the
        // wrong resource nor reports a spurious error.
        let cancelled = false;
        const cleanup = () => {
            cancelled = true;
        };
        const reportError = (error: unknown) => {
            if (!cancelled) onLoadError?.(error);
        };
        const emitData = (data: Data) => {
            if (!cancelled) onDataLoad(data);
        };
        const emitAdr = (adr: Adr) => {
            if (!cancelled) onAdrLoad(adr);
        };

        if (uiType === 'Interfaces') {
            interfaceService
                .fetchInterfacesForNamespace(namespace)
                .then((interfaces) => {
                    if (cancelled) return;
                    // Interfaces are deep-linked both by id and by customId (the namespace
                    // browse page prefers the customId when one exists), so match either.
                    const match = interfaces.find(
                        (i) => String(i.id) === id || i.customId === id
                    );
                    if (match) {
                        onInterfaceLoadRef.current({
                            namespace,
                            interfaceId: match.id,
                            interfaceName: match.name,
                            interfaceDescription: match.description,
                        });
                    }
                })
                .catch(() => undefined);
            return cleanup;
        }

        if (uiType === 'Controls') {
            controlService
                .fetchControlsForDomain(namespace)
                .then((controls) => {
                    if (cancelled) return;
                    // Controls are deep-linked both by id (mobile drill-down) and by name slug
                    // (global/Explorer search), so match either. An explicit path or variant pins
                    // one file among controls that share the id; only an empty value means "none".
                    const byId = controls.filter((c) => c.id === id);
                    const byName = controls.filter((c) => c.name === id);
                    const candidates = byId.length > 0 ? byId : byName;
                    const match = hasControlIdentity
                        ? candidates.find(
                              (c) =>
                                  (c.tags?.path ?? '') === controlPath &&
                                  (c.tags?.variant ?? '') === controlVariant
                          )
                        : candidates[0];
                    if (!match) {
                        reportError(new Error(`Control ${id} not found in domain ${namespace}`));
                        return;
                    }
                    onControlLoadRef.current({
                        domain: namespace,
                        controlId: match.id,
                        controlName: match.name,
                        controlDescription: match.description,
                        controlTitle: match.title,
                        path: controlPath || undefined,
                        variant: controlVariant || undefined,
                    });
                })
                .catch(reportError);
            return cleanup;
        }

        if (isSlug(id)) {
            loadResourceForId(version, uiType, namespace, id, calmService, emitData, reportError);
        } else {
            loadResource({
                version,
                type: uiType,
                namespace,
                resourceID: id,
                calmService,
                onDataLoad: emitData,
                onAdrLoad: emitAdr,
                adrService,
                onError: reportError,
            });
        }
        return cleanup;
    }, [resourceKey, namespace, type, id, version, controlPath, controlVariant, hasControlIdentity, calmService, adrService, interfaceService, controlService, onDataLoad, onAdrLoad, onLoadError]);
}
