import { create } from 'zustand';
import type { ParsedRequirement } from '../../../extension/services/requirement-parser';

export type ControlPickerTarget =
    | { type: 'node'; nodeId: string }
    | { type: 'document' }
    | { type: 'standard-node-draft'; onAttach: (ref: string, parsed: ParsedRequirement) => void; existingKeys?: Set<string> }
    | null;

interface StandardsControlsUiState {
    showStandardNodeCreator: boolean;
    showControlCreator: boolean;
    showControlPicker: boolean;
    controlPickerTarget: ControlPickerTarget;
    expandControlKey: string | null;
    setShowStandardNodeCreator: (show: boolean) => void;
    setShowControlCreator: (show: boolean) => void;
    openControlPicker: (target: ControlPickerTarget) => void;
    closeControlPicker: () => void;
    setExpandControlKey: (key: string | null) => void;
}

export const useStandardsControlsUi = create<StandardsControlsUiState>((set) => ({
    showStandardNodeCreator: false,
    showControlCreator: false,
    showControlPicker: false,
    controlPickerTarget: null,
    expandControlKey: null,
    setShowStandardNodeCreator: (show) => set({ showStandardNodeCreator: show }),
    setShowControlCreator: (show) => set({ showControlCreator: show }),
    openControlPicker: (target) => set({ showControlPicker: true, controlPickerTarget: target }),
    closeControlPicker: () => set({ showControlPicker: false, controlPickerTarget: null }),
    setExpandControlKey: (key) => set({ expandControlKey: key }),
}));