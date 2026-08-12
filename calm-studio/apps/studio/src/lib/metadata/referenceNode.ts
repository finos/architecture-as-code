// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/** True when the node is a cross-file reference proxy (R18). */
export function isReferenceNode(data: {
	isReference?: boolean;
	calmDetails?: Record<string, unknown>;
}): boolean {
	if (data.isReference === true) return true;
	const href = data.calmDetails?.['detailed-architecture'];
	return typeof href === 'string' && href.length > 0;
}

export function getDetailedArchitectureHref(data: {
	calmDetails?: Record<string, unknown>;
}): string | undefined {
	const href = data.calmDetails?.['detailed-architecture'];
	return typeof href === 'string' && href.length > 0 ? href : undefined;
}
