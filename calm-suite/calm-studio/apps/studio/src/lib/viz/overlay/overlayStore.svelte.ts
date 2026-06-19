// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

export type OverlayMode = 'default' | 'threat';

export interface OverlayState {
	mode: OverlayMode;
	toggle: () => void;
	setMode: (m: OverlayMode) => void;
}

export function createOverlayStore(initial: OverlayMode = 'default'): OverlayState {
	let mode = $state<OverlayMode>(initial);
	return {
		get mode() {
			return mode;
		},
		toggle: () => {
			mode = mode === 'default' ? 'threat' : 'default';
		},
		setMode: (m) => {
			mode = m;
		}
	};
}
