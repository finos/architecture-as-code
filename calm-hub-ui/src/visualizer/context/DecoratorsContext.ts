import { createContext, useContext } from 'react';
import type { Decorator } from '../contracts/contracts.js';

export interface DecoratorsState {
    /** Every decorator of the architecture version on screen. */
    decorators: Decorator[];
    /** The container that draws each containment relationship, as the overlays fold them (`containersOfContainment`). */
    drawnAs: ReadonlyMap<string, string>;
}

/** The decorators of the architecture on screen, for the details drawer. */
export const DecoratorsContext = createContext<DecoratorsState>({ decorators: [], drawnAs: new Map() });
export const useDecorators = () => useContext(DecoratorsContext);
