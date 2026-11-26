import { createContext, useContext } from 'react';

export type UiConfigStatus = 'loading' | 'loaded' | 'failed';

/** `loaded` by default, so that a test that provides only `UiConfigContext` sees its config as final. */
export const UiConfigStatusContext = createContext<UiConfigStatus>('loaded');

/** Lets a part of the page that depends on the config, such as the logo, wait instead of showing the default first. */
export function useUiConfigStatus(): UiConfigStatus {
    return useContext(UiConfigStatusContext);
}
