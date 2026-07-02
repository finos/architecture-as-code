// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { Dimension } from '@calmstudio/calm-core';

export interface GroupingState {
	dimension: Dimension;
	setDimension: (d: Dimension) => void;
	customKey: string | null;
	setCustomKey: (k: string | null) => void;
}

export function createGroupingStore(initial: Dimension): GroupingState {
	let dimension = $state<Dimension>(initial);
	let customKey = $state<string | null>(null);
	return {
		get dimension() {
			return dimension;
		},
		setDimension: (d) => {
			dimension = d;
		},
		get customKey() {
			return customKey;
		},
		setCustomKey: (k) => {
			customKey = k;
		}
	};
}
