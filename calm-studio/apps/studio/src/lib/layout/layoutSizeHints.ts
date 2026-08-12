// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Build per-node size hints for ELK so layout spacing matches rendered boxes.
 */

import type { CalmArchitecture } from '@calmstudio/calm-core';
import {
	estimateRectangleNodeSize,
	ARCHIMATE_ICON_WIDTH,
} from '../canvas/rectangleNodeSize';
import {
	CONTAINER_DEFAULT_WIDTH,
	CONTAINER_DEFAULT_HEIGHT,
} from '../canvas/containment';

const DEFAULT_W = 180;
const DEFAULT_H = 70;

export function buildLayoutSizeHints(
	arch: CalmArchitecture,
	canvasNodes: Array<{
		id: string;
		width?: number;
		height?: number;
		measured?: { width?: number; height?: number };
		type?: string;
		data?: Record<string, unknown>;
	}> = []
): Map<string, { width: number; height: number }> {
	const byId = new Map(canvasNodes.map((n) => [n.id, n]));
	const hints = new Map<string, { width: number; height: number }>();

	for (const cn of arch.nodes) {
		const id = cn['unique-id'];
		const canvas = byId.get(id);
		const details = cn.details as Record<string, unknown> | undefined;
		const isReference =
			typeof details?.['detailed-architecture'] === 'string' &&
			!!(details['detailed-architecture'] as string).trim();
		const iconWidth = cn['node-type'].startsWith('archimate:')
			? ARCHIMATE_ICON_WIDTH
			: undefined;
		const estimated = estimateRectangleNodeSize(cn.name, {
			hasReference: isReference,
			hasClassification: !!cn['data-classification'],
			iconWidth,
		});

		const measuredW = canvas?.measured?.width ?? canvas?.width;
		const measuredH = canvas?.measured?.height ?? canvas?.height;
		const isContainer =
			canvas?.type === 'container' ||
			cn['node-type'] === 'system' ||
			cn['node-type'] === 'container';

		if (isContainer && canvas?.type === 'container') {
			hints.set(id, {
				width: Math.max(
					CONTAINER_DEFAULT_WIDTH,
					measuredW ?? 0,
					estimated.width
				),
				height: Math.max(
					CONTAINER_DEFAULT_HEIGHT,
					measuredH ?? 0,
					estimated.height
				),
			});
		} else {
			hints.set(id, {
				width: Math.max(DEFAULT_W, estimated.width, measuredW ?? 0),
				height: Math.max(DEFAULT_H, estimated.height, measuredH ?? 0),
			});
		}
	}

	return hints;
}
