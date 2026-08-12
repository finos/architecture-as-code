// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

export interface CalmNodePreview {
	uniqueId: string;
	name: string;
	nodeType: string;
	description: string;
}

export interface ExplorerFileEntry {
	kind: 'file';
	name: string;
	relativePath: string;
	handle: FileSystemFileHandle;
	isCalm: boolean;
	nodes?: CalmNodePreview[];
	nodesLoaded?: boolean;
}

export interface ExplorerDirectoryEntry {
	kind: 'directory';
	name: string;
	relativePath: string;
	children: ExplorerTreeEntry[];
}

export type ExplorerTreeEntry = ExplorerDirectoryEntry | ExplorerFileEntry;

/** Payload for drag-and-drop of a CALM node from the file explorer. */
export interface CalmNodeRefDragPayload {
	sourceRelativePath: string;
	nodeUniqueId: string;
	name: string;
	nodeType: string;
	description: string;
}

export const CALM_NODE_REF_MIME = 'application/calm-node-ref';
