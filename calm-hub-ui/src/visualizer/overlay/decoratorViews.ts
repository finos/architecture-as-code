import type { DecoratorView } from '../contracts/contracts.js';
import { BUILTIN_DECORATOR_VIEWS } from './builtinDecoratorViews.js';

/** The decorator views on offer. Built in for now; the registry will serve them. */
export function useDecoratorViews(): readonly DecoratorView[] {
    return BUILTIN_DECORATOR_VIEWS;
}
