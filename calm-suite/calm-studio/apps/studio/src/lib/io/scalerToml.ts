// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * scalerToml.ts — Pure CALM-to-Scaler.toml converter.
 *
 * Converts a CalmArchitecture containing OpenGRIS nodes into a valid
 * Scaler.toml configuration string. This is a pure function with no side
 * effects: takes CalmArchitecture, returns string.
 *
 * Node-to-TOML section mapping:
 * - opengris:scheduler       → [scheduler]
 * - opengris:cluster         → [cluster]
 * - opengris:object-storage  → [object_storage_server]
 * - opengris:worker-manager  → [native_worker_manager] / [ecs_worker_manager] / etc.
 * - opengris:task-graph      → [top]
 * - opengris:parallel-function → contributes to [top]
 * - opengris:worker          → contributes max_workers count to worker-manager sections
 * - opengris:client          → contributes client_address (address auto-derived from topology)
 *
 * Anti-patterns avoided:
 * - Does NOT mutate arch.nodes or arch.relationships (read-only)
 * - Does NOT emit sections for non-opengris node types
 * - Does NOT use a TOML library (flat format, hand-crafted strings are correct and type-safe)
 * - Does NOT hardcode waterfall order (derived from priority metadata)
 */

import type { CalmArchitecture, CalmNode, CalmRelationship } from '@calmstudio/calm-core';

// ─── Known integer keys (emit unquoted in TOML) ───────────────────────────────

/**
 * TOML integer keys — values from customMetadata must be emitted without quotes.
 * All other values are emitted as quoted strings.
 */
const INTEGER_KEYS = new Set<string>([
	'worker_count',
	'max_parallel_tasks',
	'priority',
	'port',
	'max_workers',
]);

// ─── Worker-manager type to section name mapping ──────────────────────────────

const MANAGER_TYPE_TO_SECTION: Record<string, string> = {
	native: 'native_worker_manager',
	ecs: 'ecs_worker_manager',
	symphony: 'symphony_worker_manager',
	aws_hpc: 'aws_hpc_worker_manager',
};

// ─── Default values ───────────────────────────────────────────────────────────

const DEFAULTS = {
	SCHEDULER_ADDRESS: 'tcp://127.0.0.1:8516',
	CLUSTER_NAME: 'scaler-cluster',
	STORAGE_ADDRESS: 'tcp://127.0.0.1:8517',
	MAX_PARALLEL_TASKS: 4,
	MANAGER_TYPE: 'native',
} as const;

// ─── TOML value emission helper ───────────────────────────────────────────────

/**
 * Emit a TOML value: unquoted for known integer keys, quoted string for all others.
 * Appends a comment indicating whether the value was user-set or is a default.
 */
function tomlValue(key: string, value: string | number, source: 'user-set' | 'default'): string {
	const emitted = INTEGER_KEYS.has(key) ? String(value) : `"${value}"`;
	return `${key} = ${emitted} # ${source}`;
}

/**
 * Emit a TOML value that is always known (no source comment needed).
 */
function tomlFixed(key: string, value: string | number): string {
	const emitted = INTEGER_KEYS.has(key) ? String(value) : `"${value}"`;
	return `${key} = ${emitted}`;
}

// ─── Address auto-derivation ──────────────────────────────────────────────────

/**
 * Parse a tcp://host:port address and return the port number, or null on failure.
 */
function parsePort(address: string): number | null {
	const match = /^tcp:\/\/([^:]+):(\d+)$/.exec(address);
	if (!match) return null;
	return parseInt(match[2], 10);
}

/**
 * Given a tcp://host:port address, return a new address with port incremented by delta.
 */
function incrementPort(address: string, delta: number): string {
	const match = /^tcp:\/\/([^:]+):(\d+)$/.exec(address);
	if (!match) return address;
	const newPort = parseInt(match[2], 10) + delta;
	return `tcp://${match[1]}:${newPort}`;
}

/**
 * Build a map of node unique-id → CalmNode for O(1) lookup.
 */
function buildNodeMap(nodes: CalmNode[]): Map<string, CalmNode> {
	const map = new Map<string, CalmNode>();
	for (const node of nodes) {
		map.set(node['unique-id'], node);
	}
	return map;
}

/**
 * Find the peer node for a given node in a connects relationship.
 * Returns null if no relevant relationship or peer is found.
 */
function findConnectedPeers(
	nodeId: string,
	relationships: CalmRelationship[],
	nodeMap: Map<string, CalmNode>
): CalmNode[] {
	const peers: CalmNode[] = [];
	for (const rel of relationships) {
		if (rel['relationship-type'] !== 'connects') continue;
		let peerId: string | null = null;
		if (rel.source === nodeId) peerId = rel.destination;
		else if (rel.destination === nodeId) peerId = rel.source;
		if (peerId !== null) {
			const peer = nodeMap.get(peerId);
			if (peer) peers.push(peer);
		}
	}
	return peers;
}

/**
 * Auto-derive a storage_address for an object-storage node from topology.
 * Strategy: find a connected scheduler node with an explicit scheduler_address,
 * then increment the port by 1.
 *
 * Returns null if no suitable peer is found (caller should fall back to default).
 */
function deriveStorageAddress(
	storageNode: CalmNode,
	relationships: CalmRelationship[],
	nodeMap: Map<string, CalmNode>
): string | null {
	const peers = findConnectedPeers(storageNode['unique-id'], relationships, nodeMap);
	for (const peer of peers) {
		const peerAddr = peer.customMetadata?.['scheduler_address'];
		if (peerAddr && peer['node-type'] === 'opengris:scheduler' && parsePort(peerAddr) !== null) {
			return incrementPort(peerAddr, 1);
		}
	}
	return null;
}

/**
 * Auto-derive a client_address for a client node from topology.
 * Strategy: find a connected scheduler node with an explicit scheduler_address,
 * then increment the port by 2.
 *
 * Returns null if no suitable peer is found.
 */
function deriveClientAddress(
	clientNode: CalmNode,
	relationships: CalmRelationship[],
	nodeMap: Map<string, CalmNode>
): string | null {
	const peers = findConnectedPeers(clientNode['unique-id'], relationships, nodeMap);
	for (const peer of peers) {
		const peerAddr = peer.customMetadata?.['scheduler_address'];
		if (peerAddr && peer['node-type'] === 'opengris:scheduler' && parsePort(peerAddr) !== null) {
			return incrementPort(peerAddr, 2);
		}
	}
	return null;
}

// ─── Section builders ─────────────────────────────────────────────────────────

/**
 * Build the [scheduler] TOML section.
 * If multiple worker-managers are provided, injects a waterfall policy array.
 */
function buildSchedulerSection(
	node: CalmNode,
	workerManagers: CalmNode[],
	managerSectionNames: string[]
): string {
	const meta = node.customMetadata ?? {};
	const lines: string[] = [
		'[scheduler]',
		'# OpenGRIS Scaler scheduler — coordinates work distribution to worker managers',
	];

	const addrRaw = meta['scheduler_address'];
	if (addrRaw !== undefined) {
		lines.push(tomlValue('scheduler_address', addrRaw, 'user-set'));
	} else {
		lines.push(tomlValue('scheduler_address', DEFAULTS.SCHEDULER_ADDRESS, 'default'));
	}

	// Waterfall policy: only emitted when 2+ worker-managers present
	if (managerSectionNames.length > 1) {
		const waterfallArr = managerSectionNames.map((n) => `"${n}"`).join(', ');
		lines.push(`worker_manager_waterfall = [${waterfallArr}]`);
	}

	// Emit any additional user metadata (not scheduler_address — already handled)
	for (const [key, val] of Object.entries(meta)) {
		if (key === 'scheduler_address') continue;
		lines.push(tomlFixed(key, val));
	}

	return lines.join('\n');
}

/**
 * Build the [cluster] TOML section.
 */
function buildClusterSection(node: CalmNode): string {
	const meta = node.customMetadata ?? {};
	const lines: string[] = [
		'[cluster]',
		'# OpenGRIS cluster — logical grouping of scheduler and workers',
	];

	const nameRaw = meta['cluster_name'];
	if (nameRaw !== undefined) {
		lines.push(tomlValue('cluster_name', nameRaw, 'user-set'));
	} else {
		lines.push(tomlValue('cluster_name', DEFAULTS.CLUSTER_NAME, 'default'));
	}

	for (const [key, val] of Object.entries(meta)) {
		if (key === 'cluster_name') continue;
		lines.push(tomlFixed(key, val));
	}

	return lines.join('\n');
}

/**
 * Build the [object_storage_server] TOML section.
 * Supports address auto-derivation from topology when storage_address is absent.
 */
function buildObjectStorageSection(
	node: CalmNode,
	relationships: CalmRelationship[],
	nodeMap: Map<string, CalmNode>
): string {
	const meta = node.customMetadata ?? {};
	const lines: string[] = [
		'[object_storage_server]',
		'# OpenGRIS object storage — persists task results and intermediate data',
	];

	const addrRaw = meta['storage_address'];
	if (addrRaw !== undefined) {
		lines.push(tomlValue('storage_address', addrRaw, 'user-set'));
	} else {
		// Try topology auto-derivation
		const derived = deriveStorageAddress(node, relationships, nodeMap);
		if (derived !== null) {
			lines.push(tomlValue('storage_address', derived, 'default'));
		} else {
			lines.push(tomlValue('storage_address', DEFAULTS.STORAGE_ADDRESS, 'default'));
		}
	}

	for (const [key, val] of Object.entries(meta)) {
		if (key === 'storage_address') continue;
		lines.push(tomlFixed(key, val));
	}

	return lines.join('\n');
}

/**
 * Determine the TOML section name for a worker-manager node.
 * Defaults to 'native_worker_manager' if manager_type is not set.
 */
function managerSectionName(node: CalmNode, suffix?: string): string {
	const managerType = node.customMetadata?.['manager_type'] ?? DEFAULTS.MANAGER_TYPE;
	const base = MANAGER_TYPE_TO_SECTION[managerType] ?? 'native_worker_manager';
	return suffix ? `${base}${suffix}` : base;
}

/**
 * Build a worker-manager TOML section.
 * Section name is derived from manager_type metadata.
 * Default max_workers is derived from worker node count.
 */
function buildWorkerManagerSection(
	node: CalmNode,
	sectionName: string,
	workerCount: number
): string {
	const meta = node.customMetadata ?? {};
	const managerType = meta['manager_type'] ?? DEFAULTS.MANAGER_TYPE;
	const lines: string[] = [
		`[${sectionName}]`,
		`# OpenGRIS worker manager — manages worker pool (type: ${managerType})`,
	];

	// max_workers: explicit metadata overrides derived worker count
	const maxWorkersRaw = meta['max_workers'];
	if (maxWorkersRaw !== undefined) {
		lines.push(tomlValue('max_workers', maxWorkersRaw, 'user-set'));
	} else if (workerCount > 0) {
		lines.push(tomlValue('max_workers', workerCount, 'default'));
	}

	// Emit extra keys based on manager_type
	for (const [key, val] of Object.entries(meta)) {
		if (key === 'manager_type' || key === 'max_workers' || key === 'priority') continue;
		lines.push(tomlFixed(key, val));
	}

	// Emit priority if present (as integer)
	const priorityRaw = meta['priority'];
	if (priorityRaw !== undefined) {
		lines.push(tomlFixed('priority', parseInt(priorityRaw, 10)));
	}

	return lines.join('\n');
}

/**
 * Build a [worker] TOML section for an individual opengris:worker node.
 * Workers don't have a canonical Scaler.toml section but their metadata
 * (e.g. worker_count, worker_capabilities) is emitted for reference.
 */
function buildWorkerSection(node: CalmNode, index: number): string {
	const meta = node.customMetadata ?? {};
	const suffix = index > 0 ? `_${index + 1}` : '';
	const lines: string[] = [
		`[worker${suffix}]`,
		`# OpenGRIS worker node — ${node.name}`,
	];

	for (const [key, val] of Object.entries(meta)) {
		lines.push(tomlFixed(key, val));
	}

	return lines.join('\n');
}

/**
 * Build the [top] TOML section for task orchestration.
 * Only emitted when task-graph or parallel-function nodes exist.
 */
function buildTopSection(
	taskGraphNodes: CalmNode[],
	parallelFunctionNodes: CalmNode[]
): string {
	const lines: string[] = [
		'[top]',
		'# OpenGRIS task orchestration — controls parallel task execution',
	];

	// max_parallel_tasks: take from first task-graph node, default to 4
	const tgMeta = taskGraphNodes[0]?.customMetadata ?? {};
	const maxParallelRaw = tgMeta['max_parallel_tasks'];
	if (maxParallelRaw !== undefined) {
		lines.push(tomlValue('max_parallel_tasks', parseInt(maxParallelRaw, 10), 'user-set'));
	} else {
		lines.push(tomlValue('max_parallel_tasks', DEFAULTS.MAX_PARALLEL_TASKS, 'default'));
	}

	// Emit function_name from parallel-function nodes
	for (const pfNode of parallelFunctionNodes) {
		const fnName = pfNode.customMetadata?.['function_name'];
		if (fnName !== undefined) {
			lines.push(tomlFixed('function_name', fnName));
		}
	}

	// Extra keys from task-graph nodes
	for (const [key, val] of Object.entries(tgMeta)) {
		if (key === 'max_parallel_tasks') continue;
		lines.push(tomlFixed(key, val));
	}

	return lines.join('\n');
}

/**
 * Build the client address entry (contributes to output as a field under [top] or standalone).
 * Auto-derives from topology if not in customMetadata.
 */
function buildClientSection(
	node: CalmNode,
	relationships: CalmRelationship[],
	nodeMap: Map<string, CalmNode>
): string {
	const meta = node.customMetadata ?? {};
	const lines: string[] = [
		`# opengris:client — ${node.name}`,
	];

	const addrRaw = meta['client_address'];
	if (addrRaw !== undefined) {
		lines.push(tomlValue('client_address', addrRaw, 'user-set'));
	} else {
		const derived = deriveClientAddress(node, relationships, nodeMap);
		if (derived !== null) {
			lines.push(tomlValue('client_address', derived, 'default'));
		}
		// If no address can be derived, omit the key — it's optional
	}

	return lines.join('\n');
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Convert a CalmArchitecture to a Scaler.toml configuration string.
 *
 * Only `opengris:*` nodes are processed. All other node types are silently
 * skipped. The output is a hand-crafted TOML string with inline comments.
 *
 * @param arch  The CALM architecture to convert
 * @returns     A valid Scaler.toml configuration string
 */
export function buildScalerToml(arch: CalmArchitecture): string {
	const { nodes, relationships } = arch;
	const nodeMap = buildNodeMap(nodes);

	// ── Filter opengris nodes by type ────────────────────────────────────────
	const schedulerNodes = nodes.filter((n) => n['node-type'] === 'opengris:scheduler');
	const clusterNodes = nodes.filter((n) => n['node-type'] === 'opengris:cluster');
	const objectStorageNodes = nodes.filter((n) => n['node-type'] === 'opengris:object-storage');
	const workerNodes = nodes.filter((n) => n['node-type'] === 'opengris:worker');
	const workerManagerNodes = nodes.filter((n) => n['node-type'] === 'opengris:worker-manager');
	const taskGraphNodes = nodes.filter((n) => n['node-type'] === 'opengris:task-graph');
	const parallelFunctionNodes = nodes.filter((n) => n['node-type'] === 'opengris:parallel-function');
	const clientNodes = nodes.filter((n) => n['node-type'] === 'opengris:client');

	const workerCount = workerNodes.length;

	// ── Prepare worker-manager sections with deduplication ───────────────────
	// Sort by priority ascending (lower number = higher priority in waterfall)
	const sortedManagers = [...workerManagerNodes].sort((a, b) => {
		const pa = parseInt(a.customMetadata?.['priority'] ?? '99', 10);
		const pb = parseInt(b.customMetadata?.['priority'] ?? '99', 10);
		return pa - pb;
	});

	// Track seen section base names for duplicate detection
	const seenSectionNames = new Map<string, number>();
	const managerSectionNames: string[] = [];

	for (const wm of sortedManagers) {
		const baseName = managerSectionName(wm);
		const count = seenSectionNames.get(baseName) ?? 0;
		seenSectionNames.set(baseName, count + 1);
		const suffix = count > 0 ? `_${count + 1}` : '';
		managerSectionNames.push(`${baseName}${suffix}`);
	}

	// ── Build output sections ─────────────────────────────────────────────────
	const sections: string[] = [];

	// File header
	sections.push(
		[
			'# Generated by CalmStudio — https://github.com/finos/architecture-as-code',
			'# Do not edit manually — update the CALM architecture and re-export.',
			`# Generated: ${new Date().toISOString().split('T')[0]}`,
		].join('\n')
	);

	// [scheduler] — always first if present; includes waterfall if multiple managers
	for (const node of schedulerNodes) {
		sections.push(buildSchedulerSection(node, sortedManagers, managerSectionNames));
	}

	// [cluster]
	for (const node of clusterNodes) {
		sections.push(buildClusterSection(node));
	}

	// Worker-manager sections (in priority order)
	for (let i = 0; i < sortedManagers.length; i++) {
		sections.push(buildWorkerManagerSection(sortedManagers[i], managerSectionNames[i], workerCount));
	}

	// [worker] sections — one per worker node (emit metadata like worker_count)
	for (let i = 0; i < workerNodes.length; i++) {
		const workerMeta = workerNodes[i].customMetadata ?? {};
		// Only emit a [worker] section if the node has custom metadata
		if (Object.keys(workerMeta).length > 0) {
			sections.push(buildWorkerSection(workerNodes[i], i));
		}
	}

	// [object_storage_server]
	for (const node of objectStorageNodes) {
		sections.push(buildObjectStorageSection(node, relationships, nodeMap));
	}

	// Client address entries
	for (const node of clientNodes) {
		const clientSection = buildClientSection(node, relationships, nodeMap);
		// Only add if there's actual content beyond the comment
		if (clientSection.includes('client_address')) {
			sections.push(clientSection);
		}
	}

	// [top] — only when task-graph or parallel-function nodes present
	if (taskGraphNodes.length > 0 || parallelFunctionNodes.length > 0) {
		sections.push(buildTopSection(taskGraphNodes, parallelFunctionNodes));
	}

	return sections.join('\n\n');
}
