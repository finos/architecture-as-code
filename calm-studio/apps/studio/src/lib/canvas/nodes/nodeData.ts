// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { StudioCalmInterface } from '$lib/canvas/flowTypes';

/** Returns typed interface handles for node components, or undefined when absent. */
export function getNodeInterfaces(data: Record<string, unknown>): StudioCalmInterface[] | undefined {
	const ifaces = data.interfaces;
	if (!Array.isArray(ifaces)) return undefined;
	return ifaces as StudioCalmInterface[];
}
