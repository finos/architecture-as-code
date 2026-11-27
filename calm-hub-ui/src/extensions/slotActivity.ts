import { createContext, useContext } from 'react';

/**
 * False while a place keeps its slots mounted but hidden, such as a closed inspector or an extension that is not on
 * show. A hidden slot keeps its state and sends no request. It loads again when it shows, if its context changed.
 */
export const SlotActiveContext = createContext(true);

export function useSlotActive(): boolean {
    return useContext(SlotActiveContext);
}

/**
 * Names the element that holds a place's slots, such as the side panel or the full-screen dialog of the inspector. A new
 * value moves the slots in the page and keeps them mounted. The browser then ends the modal state of an open dialog in
 * a slot, which stays open, so the dialog must show itself modally again.
 */
export const SlotHostContext = createContext('');

export function useSlotHost(): string {
    return useContext(SlotHostContext);
}
