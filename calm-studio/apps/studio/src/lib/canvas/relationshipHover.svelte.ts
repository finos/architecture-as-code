// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

let token = 0;
let hover = $state<{ token: number; source: string; target: string } | null>(null);

export function setRelationshipHover(source: string, target: string): number {
	token += 1;
	hover = { token, source, target };
	return token;
}

export function clearRelationshipHover(expected: number): void {
	if (hover?.token === expected) hover = null;
}

export function relationshipHoverEnds(): { source: string; target: string } | null {
	if (!hover) return null;
	return { source: hover.source, target: hover.target };
}
