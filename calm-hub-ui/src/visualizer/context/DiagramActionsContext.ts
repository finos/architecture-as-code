import { createContext, useContext } from 'react';

interface DiagramActionsContextValue {
    onNavigateToDetailedArch?: (ref: string) => void;
}

export const DiagramActionsContext = createContext<DiagramActionsContextValue>({});
export const useDiagramActions = () => useContext(DiagramActionsContext);
