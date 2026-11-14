import { createContext } from 'react';
import { ExtensionContext } from '../model/extensions.js';

export const ExtensionResourceContext = createContext<ExtensionContext | null>(null);
