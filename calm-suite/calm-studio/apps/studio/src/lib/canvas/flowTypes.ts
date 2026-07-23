// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmInterfaceTypeSchema } from '@finos/calm-models/types';
import type { CalmControls, CalmProtocol, CalmTransition } from '@calmstudio/calm-core';

/** Typed CALM interface as edited in CalmStudio (url, host-port, …). */
export type StudioCalmInterface = CalmInterfaceTypeSchema & {
	type?: string;
	value?: string;
};

/** Svelte Flow node.data payload produced by calmToFlow. */
export interface CalmFlowNodeData {
	calmId: string;
	label?: string;
	description?: string;
	calmType?: string;
	interfaces?: StudioCalmInterface[];
	controls?: CalmControls;
	customMetadata?: Record<string, string>;
	metadata?: Record<string, unknown>;
	collapsed?: boolean;
	pinned?: boolean;
	isReference?: boolean;
	calmDetails?: Record<string, unknown>;
	validationErrors?: number;
	validationWarnings?: number;
	[key: string]: unknown;
}

/** Svelte Flow edge.data payload produced by calmToFlow. */
export interface CalmFlowEdgeData {
	calmRelId?: string;
	calmVariant?: string;
	protocol?: CalmProtocol | string;
	description?: string;
	controls?: CalmControls;
	metadata?: Record<string, unknown>;
	flowTransition?: CalmTransition;
	dimmed?: boolean;
	validationSeverity?: string;
	[key: string]: unknown;
}

export function asCalmFlowNodeData(data: Record<string, unknown> | undefined): CalmFlowNodeData {
	return (data ?? {}) as CalmFlowNodeData;
}

export function asCalmFlowEdgeData(data: Record<string, unknown> | undefined): CalmFlowEdgeData {
	return (data ?? {}) as CalmFlowEdgeData;
}
