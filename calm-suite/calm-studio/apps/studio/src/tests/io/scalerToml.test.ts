// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * scalerToml.test.ts — Unit tests for buildScalerToml pure function.
 *
 * Tests cover:
 * - Core section emission per OpenGRIS node type
 * - Metadata override vs. default fallback
 * - Address auto-derivation from topology (connects relationships)
 * - Type coercion (integer keys unquoted, string keys quoted)
 * - Waterfall policy for multiple worker-managers
 * - Worker count contribution to max_workers
 * - Edge cases: non-opengris nodes skipped, empty arch, [top] conditional
 * - Output format: header comment, blank-line separators, valid TOML syntax
 */

import { describe, it, expect } from 'vitest';
import { buildScalerToml } from '$lib/io/scalerToml';
import type { CalmArchitecture, CalmNode, CalmRelationship } from '@calmstudio/calm-core';

// ─── Test fixture helpers ─────────────────────────────────────────────────────

function makeNode(
	id: string,
	nodeType: string,
	meta?: Record<string, string>
): CalmNode {
	return {
		'unique-id': id,
		'node-type': nodeType,
		name: id,
		description: `Test node ${id}`,
		customMetadata: meta,
	};
}

function makeRelationship(
	id: string,
	source: string,
	destination: string,
	type: CalmRelationship['relationship-type'] = 'connects'
): CalmRelationship {
	return {
		'unique-id': id,
		'relationship-type': type,
		source,
		destination,
	};
}

function makeArch(nodes: CalmNode[], relationships: CalmRelationship[] = []): CalmArchitecture {
	return { nodes, relationships };
}

// ─── Core Section Emission ────────────────────────────────────────────────────

describe('buildScalerToml — core section emission', () => {
	it('emits a [scheduler] section for an opengris:scheduler node', () => {
		const arch = makeArch([makeNode('sched-1', 'opengris:scheduler')]);
		const result = buildScalerToml(arch);
		expect(result).toContain('[scheduler]');
	});

	it('emits a [cluster] section for an opengris:cluster node', () => {
		const arch = makeArch([makeNode('cluster-1', 'opengris:cluster')]);
		const result = buildScalerToml(arch);
		expect(result).toContain('[cluster]');
	});

	it('emits an [object_storage_server] section for an opengris:object-storage node', () => {
		const arch = makeArch([makeNode('storage-1', 'opengris:object-storage')]);
		const result = buildScalerToml(arch);
		expect(result).toContain('[object_storage_server]');
	});

	it('emits a [native_worker_manager] section for worker-manager with manager_type=native', () => {
		const arch = makeArch([
			makeNode('wm-1', 'opengris:worker-manager', { manager_type: 'native' }),
		]);
		const result = buildScalerToml(arch);
		expect(result).toContain('[native_worker_manager]');
	});

	it('emits an [ecs_worker_manager] section for worker-manager with manager_type=ecs', () => {
		const arch = makeArch([
			makeNode('wm-ecs', 'opengris:worker-manager', {
				manager_type: 'ecs',
				ecs_cluster: 'my-cluster',
				ecs_task_definition: 'scaler-worker',
			}),
		]);
		const result = buildScalerToml(arch);
		expect(result).toContain('[ecs_worker_manager]');
		expect(result).toContain('ecs_cluster');
		expect(result).toContain('ecs_task_definition');
	});

	it('emits a [symphony_worker_manager] section for worker-manager with manager_type=symphony', () => {
		const arch = makeArch([
			makeNode('wm-sym', 'opengris:worker-manager', { manager_type: 'symphony' }),
		]);
		const result = buildScalerToml(arch);
		expect(result).toContain('[symphony_worker_manager]');
	});

	it('emits an [aws_hpc_worker_manager] section for worker-manager with manager_type=aws_hpc', () => {
		const arch = makeArch([
			makeNode('wm-hpc', 'opengris:worker-manager', {
				manager_type: 'aws_hpc',
				aws_region: 'us-east-1',
			}),
		]);
		const result = buildScalerToml(arch);
		expect(result).toContain('[aws_hpc_worker_manager]');
		expect(result).toContain('aws_region');
	});

	it('emits a [top] section with max_parallel_tasks for an opengris:task-graph node', () => {
		const arch = makeArch([makeNode('tg-1', 'opengris:task-graph', { max_parallel_tasks: '8' })]);
		const result = buildScalerToml(arch);
		expect(result).toContain('[top]');
		expect(result).toContain('max_parallel_tasks');
	});

	it('defaults worker-manager to native section when manager_type is absent', () => {
		const arch = makeArch([makeNode('wm-default', 'opengris:worker-manager')]);
		const result = buildScalerToml(arch);
		expect(result).toContain('[native_worker_manager]');
	});
});

// ─── Metadata and Defaults ────────────────────────────────────────────────────

describe('buildScalerToml — metadata override vs. defaults', () => {
	it('uses customMetadata scheduler_address when present', () => {
		const arch = makeArch([
			makeNode('sched', 'opengris:scheduler', { scheduler_address: 'tcp://10.0.0.1:9000' }),
		]);
		const result = buildScalerToml(arch);
		expect(result).toContain('tcp://10.0.0.1:9000');
	});

	it('falls back to default scheduler_address tcp://127.0.0.1:8516 when metadata absent', () => {
		const arch = makeArch([makeNode('sched', 'opengris:scheduler')]);
		const result = buildScalerToml(arch);
		expect(result).toContain('tcp://127.0.0.1:8516');
	});

	it('uses customMetadata cluster_name when present', () => {
		const arch = makeArch([makeNode('cl', 'opengris:cluster', { cluster_name: 'my-cluster' })]);
		const result = buildScalerToml(arch);
		expect(result).toContain('my-cluster');
	});

	it('falls back to default cluster_name scaler-cluster when metadata absent', () => {
		const arch = makeArch([makeNode('cl', 'opengris:cluster')]);
		const result = buildScalerToml(arch);
		expect(result).toContain('scaler-cluster');
	});

	it('uses customMetadata storage_address when present', () => {
		const arch = makeArch([
			makeNode('stor', 'opengris:object-storage', { storage_address: 'tcp://10.0.0.2:9001' }),
		]);
		const result = buildScalerToml(arch);
		expect(result).toContain('tcp://10.0.0.2:9001');
	});

	it('falls back to default storage_address tcp://127.0.0.1:8517 when metadata absent and no topology', () => {
		const arch = makeArch([makeNode('stor', 'opengris:object-storage')]);
		const result = buildScalerToml(arch);
		expect(result).toContain('tcp://127.0.0.1:8517');
	});

	it('marks metadata values as user-set in comments', () => {
		const arch = makeArch([
			makeNode('sched', 'opengris:scheduler', { scheduler_address: 'tcp://10.0.0.1:9000' }),
		]);
		const result = buildScalerToml(arch);
		expect(result).toContain('user-set');
	});

	it('marks default values as default in comments', () => {
		const arch = makeArch([makeNode('sched', 'opengris:scheduler')]);
		const result = buildScalerToml(arch);
		expect(result).toContain('default');
	});
});

// ─── Address Auto-Derivation from Topology ────────────────────────────────────

describe('buildScalerToml — address auto-derivation', () => {
	it('auto-derives storage_address from scheduler address + 1 port via connects relationship', () => {
		const nodes = [
			makeNode('sched', 'opengris:scheduler', { scheduler_address: 'tcp://127.0.0.1:8516' }),
			makeNode('stor', 'opengris:object-storage'),
		];
		const rels = [makeRelationship('r1', 'sched', 'stor')];
		const result = buildScalerToml(makeArch(nodes, rels));
		// storage_address should be derived as tcp://127.0.0.1:8517
		expect(result).toContain('tcp://127.0.0.1:8517');
	});

	it('uses explicit storage_address over auto-derived value', () => {
		const nodes = [
			makeNode('sched', 'opengris:scheduler', { scheduler_address: 'tcp://127.0.0.1:8516' }),
			makeNode('stor', 'opengris:object-storage', { storage_address: 'tcp://10.0.0.5:9999' }),
		];
		const rels = [makeRelationship('r1', 'sched', 'stor')];
		const result = buildScalerToml(makeArch(nodes, rels));
		expect(result).toContain('tcp://10.0.0.5:9999');
		// Should not contain the auto-derived value
		expect(result).not.toContain('tcp://127.0.0.1:8517');
	});

	it('falls back to static default when no connected peer has an address', () => {
		const nodes = [
			makeNode('sched', 'opengris:scheduler'), // no address metadata
			makeNode('stor', 'opengris:object-storage'),
		];
		const rels = [makeRelationship('r1', 'sched', 'stor')];
		const result = buildScalerToml(makeArch(nodes, rels));
		// Both should fall back to static defaults
		expect(result).toContain('tcp://127.0.0.1:8516');
		expect(result).toContain('tcp://127.0.0.1:8517');
	});

	it('auto-derives client_address from scheduler port + 2 via connects relationship', () => {
		const nodes = [
			makeNode('sched', 'opengris:scheduler', { scheduler_address: 'tcp://127.0.0.1:8516' }),
			makeNode('client', 'opengris:client'),
		];
		const rels = [makeRelationship('r1', 'sched', 'client')];
		const result = buildScalerToml(makeArch(nodes, rels));
		// client_address should be tcp://127.0.0.1:8518
		expect(result).toContain('tcp://127.0.0.1:8518');
	});
});

// ─── Type Coercion ────────────────────────────────────────────────────────────

describe('buildScalerToml — type coercion', () => {
	it('emits max_parallel_tasks as unquoted integer (no surrounding quotes)', () => {
		const arch = makeArch([makeNode('tg', 'opengris:task-graph', { max_parallel_tasks: '4' })]);
		const result = buildScalerToml(arch);
		// Should contain: max_parallel_tasks = 4 (not "4")
		expect(result).toMatch(/max_parallel_tasks\s*=\s*4(?!\d)/);
		expect(result).not.toContain('max_parallel_tasks = "4"');
	});

	it('emits priority as unquoted integer', () => {
		const arch = makeArch([
			makeNode('wm', 'opengris:worker-manager', { manager_type: 'native', priority: '1' }),
		]);
		const result = buildScalerToml(arch);
		expect(result).toMatch(/priority\s*=\s*1(?!\d)/);
		expect(result).not.toContain('priority = "1"');
	});

	it('emits max_workers as unquoted integer', () => {
		const arch = makeArch([
			makeNode('wm', 'opengris:worker-manager', { manager_type: 'native', max_workers: '8' }),
		]);
		const result = buildScalerToml(arch);
		expect(result).toMatch(/max_workers\s*=\s*8(?!\d)/);
		expect(result).not.toContain('max_workers = "8"');
	});

	it('emits worker_count as unquoted integer', () => {
		const arch = makeArch([makeNode('w', 'opengris:worker', { worker_count: '3' })]);
		const result = buildScalerToml(arch);
		expect(result).toMatch(/worker_count\s*=\s*3(?!\d)/);
	});

	it('emits string values with surrounding quotes', () => {
		const arch = makeArch([
			makeNode('wm', 'opengris:worker-manager', {
				manager_type: 'ecs',
				ecs_cluster: 'my-cluster',
			}),
		]);
		const result = buildScalerToml(arch);
		expect(result).toContain('ecs_cluster = "my-cluster"');
	});

	it('emits scheduler_address as a quoted string', () => {
		const arch = makeArch([
			makeNode('sched', 'opengris:scheduler', { scheduler_address: 'tcp://127.0.0.1:8516' }),
		]);
		const result = buildScalerToml(arch);
		expect(result).toContain('scheduler_address = "tcp://127.0.0.1:8516"');
	});
});

// ─── Waterfall Logic ─────────────────────────────────────────────────────────

describe('buildScalerToml — waterfall logic', () => {
	it('does NOT emit worker_manager_waterfall when only one worker-manager exists', () => {
		const arch = makeArch([
			makeNode('sched', 'opengris:scheduler'),
			makeNode('wm', 'opengris:worker-manager', { manager_type: 'native' }),
		]);
		const result = buildScalerToml(arch);
		expect(result).not.toContain('worker_manager_waterfall');
	});

	it('emits worker_manager_waterfall array in [scheduler] when multiple worker-managers exist', () => {
		const arch = makeArch([
			makeNode('sched', 'opengris:scheduler'),
			makeNode('wm1', 'opengris:worker-manager', { manager_type: 'native', priority: '1' }),
			makeNode('wm2', 'opengris:worker-manager', { manager_type: 'ecs', priority: '2' }),
		]);
		const result = buildScalerToml(arch);
		expect(result).toContain('worker_manager_waterfall');
	});

	it('sorts waterfall priority ascending (lower number = higher priority)', () => {
		const arch = makeArch([
			makeNode('sched', 'opengris:scheduler'),
			makeNode('wm1', 'opengris:worker-manager', { manager_type: 'ecs', priority: '2' }),
			makeNode('wm2', 'opengris:worker-manager', { manager_type: 'native', priority: '1' }),
		]);
		const result = buildScalerToml(arch);
		// native (priority 1) should appear before ecs (priority 2) in the waterfall array
		const waterfallIdx = result.indexOf('worker_manager_waterfall');
		const nativeIdx = result.indexOf('"native_worker_manager"');
		const ecsIdx = result.indexOf('"ecs_worker_manager"');
		expect(waterfallIdx).toBeGreaterThan(-1);
		expect(nativeIdx).toBeLessThan(ecsIdx);
	});

	it('waterfall array contains section names (e.g. native_worker_manager, ecs_worker_manager)', () => {
		const arch = makeArch([
			makeNode('sched', 'opengris:scheduler'),
			makeNode('wm1', 'opengris:worker-manager', { manager_type: 'native', priority: '1' }),
			makeNode('wm2', 'opengris:worker-manager', { manager_type: 'ecs', priority: '2' }),
		]);
		const result = buildScalerToml(arch);
		expect(result).toContain('"native_worker_manager"');
		expect(result).toContain('"ecs_worker_manager"');
	});

	it('waterfall array is in [scheduler] section, before other sections', () => {
		const arch = makeArch([
			makeNode('sched', 'opengris:scheduler'),
			makeNode('wm1', 'opengris:worker-manager', { manager_type: 'native', priority: '1' }),
			makeNode('wm2', 'opengris:worker-manager', { manager_type: 'ecs', priority: '2' }),
		]);
		const result = buildScalerToml(arch);
		const schedulerSectionIdx = result.indexOf('[scheduler]');
		const waterfallIdx = result.indexOf('worker_manager_waterfall');
		const nativeSectionIdx = result.indexOf('[native_worker_manager]');
		// waterfall must appear after [scheduler] but before [native_worker_manager]
		expect(waterfallIdx).toBeGreaterThan(schedulerSectionIdx);
		expect(waterfallIdx).toBeLessThan(nativeSectionIdx);
	});
});

// ─── Worker Count Derivation ─────────────────────────────────────────────────

describe('buildScalerToml — worker count derivation', () => {
	it('uses count of opengris:worker nodes as default max_workers on worker-manager', () => {
		const arch = makeArch([
			makeNode('w1', 'opengris:worker'),
			makeNode('w2', 'opengris:worker'),
			makeNode('w3', 'opengris:worker'),
			makeNode('wm', 'opengris:worker-manager', { manager_type: 'native' }),
		]);
		const result = buildScalerToml(arch);
		// 3 workers => max_workers = 3
		expect(result).toMatch(/max_workers\s*=\s*3(?!\d)/);
	});

	it('uses explicit max_workers from metadata over derived worker count', () => {
		const arch = makeArch([
			makeNode('w1', 'opengris:worker'),
			makeNode('w2', 'opengris:worker'),
			makeNode('wm', 'opengris:worker-manager', { manager_type: 'native', max_workers: '10' }),
		]);
		const result = buildScalerToml(arch);
		// Explicit 10 overrides derived count of 2
		expect(result).toMatch(/max_workers\s*=\s*10(?!\d)/);
	});
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe('buildScalerToml — edge cases', () => {
	it('silently skips non-opengris nodes (actor, service, system)', () => {
		const arch = makeArch([
			makeNode('actor1', 'actor'),
			makeNode('svc1', 'service'),
			makeNode('sys1', 'system'),
		]);
		const result = buildScalerToml(arch);
		// Only header comment should be present, no TOML sections
		expect(result).not.toContain('[actor]');
		expect(result).not.toContain('[service]');
		expect(result).not.toContain('[system]');
	});

	it('returns header comment only for architecture with no opengris nodes', () => {
		const arch = makeArch([makeNode('actor1', 'actor')]);
		const result = buildScalerToml(arch);
		// Should still return a non-empty string with a header
		expect(result.trim().length).toBeGreaterThan(0);
		expect(result).toContain('#');
	});

	it('does NOT emit [top] section when no task-graph or parallel-function nodes exist', () => {
		const arch = makeArch([makeNode('sched', 'opengris:scheduler')]);
		const result = buildScalerToml(arch);
		expect(result).not.toContain('[top]');
	});

	it('emits [top] section when task-graph node is present', () => {
		const arch = makeArch([makeNode('tg', 'opengris:task-graph')]);
		const result = buildScalerToml(arch);
		expect(result).toContain('[top]');
	});

	it('emits [top] section when parallel-function node is present', () => {
		const arch = makeArch([makeNode('pf', 'opengris:parallel-function', { function_name: 'my-fn' })]);
		const result = buildScalerToml(arch);
		expect(result).toContain('[top]');
	});

	it('parallel-function contributes function_name to [top] section', () => {
		const arch = makeArch([makeNode('pf', 'opengris:parallel-function', { function_name: 'compute-vega' })]);
		const result = buildScalerToml(arch);
		expect(result).toContain('function_name');
		expect(result).toContain('compute-vega');
	});

	it('appends _2 suffix to second section header when duplicate manager_type', () => {
		const arch = makeArch([
			makeNode('wm1', 'opengris:worker-manager', { manager_type: 'native', priority: '1' }),
			makeNode('wm2', 'opengris:worker-manager', { manager_type: 'native', priority: '2' }),
		]);
		const result = buildScalerToml(arch);
		expect(result).toContain('[native_worker_manager]');
		expect(result).toContain('[native_worker_manager_2]');
	});

	it('output starts with a header comment identifying CalmStudio as the source', () => {
		const arch = makeArch([makeNode('sched', 'opengris:scheduler')]);
		const result = buildScalerToml(arch);
		const firstLine = result.trimStart().split('\n')[0];
		expect(firstLine).toMatch(/^#/);
		expect(result.toLowerCase()).toContain('calmstudio');
	});
});

// ─── Output Format ────────────────────────────────────────────────────────────

describe('buildScalerToml — output format', () => {
	it('sections are separated by blank lines', () => {
		const arch = makeArch([
			makeNode('sched', 'opengris:scheduler'),
			makeNode('cl', 'opengris:cluster'),
		]);
		const result = buildScalerToml(arch);
		// Should contain at least one blank line between sections
		expect(result).toContain('\n\n');
	});

	it('uses key = value syntax for TOML fields', () => {
		const arch = makeArch([
			makeNode('sched', 'opengris:scheduler', { scheduler_address: 'tcp://127.0.0.1:8516' }),
		]);
		const result = buildScalerToml(arch);
		expect(result).toMatch(/\w+ = /);
	});

	it('each section has an inline comment explaining its purpose', () => {
		const arch = makeArch([makeNode('sched', 'opengris:scheduler')]);
		const result = buildScalerToml(arch);
		// Section header line should be followed by a comment line
		expect(result).toMatch(/\[scheduler\][^\n]*\n#/);
	});

	it('emits valid TOML: no duplicate section headers for unique manager_types', () => {
		const arch = makeArch([
			makeNode('wm1', 'opengris:worker-manager', { manager_type: 'native', priority: '1' }),
			makeNode('wm2', 'opengris:worker-manager', { manager_type: 'ecs', priority: '2' }),
		]);
		const result = buildScalerToml(arch);
		// Count occurrences of section headers — native and ecs should each appear exactly once
		const nativeCount = (result.match(/\[native_worker_manager\]/g) ?? []).length;
		const ecsCount = (result.match(/\[ecs_worker_manager\]/g) ?? []).length;
		expect(nativeCount).toBe(1);
		expect(ecsCount).toBe(1);
	});
});
