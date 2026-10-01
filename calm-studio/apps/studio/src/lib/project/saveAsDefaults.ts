// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { Node } from '@xyflow/svelte';
import type { CalmProjectConfig } from './types';
import { resolveExtractPath } from './naming';
import { selectedDirectoryPath } from '$lib/explorer/folderName';

export interface SaveAsDefaultsInput {
	selectedPath: string | null | undefined;
	filenameFallback: string;
	primaryNodeType?: string | null;
	primaryNodeName?: string | null;
	config: CalmProjectConfig | null;
}

export interface SaveAsDefaults {
	folder: string;
	fileName: string;
}

export function saveAsDefaults(input: SaveAsDefaultsInput): SaveAsDefaults {
	const folder = selectedDirectoryPath(input.selectedPath);
	const nodeType = input.primaryNodeType?.trim();
	if (nodeType && input.config) {
		const resolved = resolveExtractPath(
			nodeType,
			{ name: input.primaryNodeName || input.filenameFallback.replace(/\.json$/i, '') },
			input.config,
			folder ? `${folder}/placeholder.json` : input.filenameFallback
		);
		if (resolved.mapped && resolved.fileName) {
			return { folder: folder || resolved.folder, fileName: resolved.fileName };
		}
	}
	return { folder, fileName: input.filenameFallback };
}

export function primaryNodeFromCanvas(nodes: Node[]): { type: string; name: string } | null {
	const selected = nodes.filter((n) => n.selected && !n.parentId);
	const pool = selected.length > 0 ? selected : nodes.filter((n) => !n.parentId);
	const node = pool[0];
	if (!node) return null;
	const type = String(node.data?.calmType ?? node.type ?? '');
	const name = String(node.data?.label ?? node.data?.calmId ?? node.id);
	return type ? { type, name } : null;
}
