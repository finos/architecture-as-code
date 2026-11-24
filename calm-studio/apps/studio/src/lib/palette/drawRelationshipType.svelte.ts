// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_EDGE_TYPE } from '$lib/canvas/edgeTypes';

/** Palette choice used by the next drag between two nodes. Session only. */
let selected = $state<string>(DEFAULT_EDGE_TYPE);

export function drawRelationshipType(): string {
	return selected;
}

export function setDrawRelationshipType(typeId: string): void {
	selected = typeId;
}
