import type { ReactNode } from 'react';
import { DecoratorOverlayContext } from '../visualizer/context/DecoratorOverlayContext.js';
import { evaluationOverlayState } from './evaluation-overlay-state.js';
import type { ElementEvaluation } from '../visualizer/contracts/contracts.js';

export function EvaluationOverlayProvider({ value, children }: { value: Map<string, ElementEvaluation>; children: ReactNode }) {
    return <DecoratorOverlayContext.Provider value={evaluationOverlayState(value)}>{children}</DecoratorOverlayContext.Provider>;
}
