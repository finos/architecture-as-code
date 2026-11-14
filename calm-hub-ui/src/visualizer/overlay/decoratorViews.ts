import { useEffect, useState } from 'react';
import { useExtensionService, useExtensionsStatus } from '../../extensions/ExtensionsContext.js';
import type { DecoratorView } from '../contracts/contracts.js';
import { BUILTIN_DECORATOR_VIEWS } from './builtinDecoratorViews.js';

const NO_VIEWS: readonly DecoratorView[] = [];

/** The registered views. If the registry cannot be loaded, the built-in views, which do not need it. */
export function useDecoratorViews(): readonly DecoratorView[] {
    const service = useExtensionService();
    // The provider retries a failed registry: when it loads, read the views again.
    const loaded = useExtensionsStatus() === 'loaded';
    const [views, setViews] = useState<readonly DecoratorView[]>(NO_VIEWS);
    useEffect(() => {
        let cancelled = false;
        service.fetchDecoratorViews().then((values) => {
            if (!cancelled) setViews(values);
        }).catch(() => {
            if (!cancelled) setViews(BUILTIN_DECORATOR_VIEWS);
        });
        return () => { cancelled = true; };
    }, [service, loaded]);
    return views;
}
