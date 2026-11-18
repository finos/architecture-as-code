import { createContext, useContext } from 'react';

/**
 * False while a place keeps its slots mounted but hidden, such as a closed inspector or an extension that is not on
 * show. A hidden slot keeps its state and sends no request. It loads again when it shows, if its context changed.
 */
export const SlotActiveContext = createContext(true);

export function useSlotActive(): boolean {
    return useContext(SlotActiveContext);
}
