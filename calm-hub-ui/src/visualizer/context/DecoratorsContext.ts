import { createContext, useContext } from 'react';
import type { Decorator } from '../contracts/contracts.js';

/** Every decorator of the architecture version on screen, for the details drawer. */
export const DecoratorsContext = createContext<Decorator[]>([]);
export const useDecorators = () => useContext(DecoratorsContext);
