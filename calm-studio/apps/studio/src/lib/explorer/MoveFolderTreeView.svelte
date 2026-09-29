<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { onMount } from 'svelte';
	import type { ExplorerTreeEntry } from './types';
	import {
		PROJECT_ROOT_FIELD,
		buildMoveFolderTree,
		defaultExpandedMoveFolderPaths,
		type MoveFolderTreeNode,
	} from './moveDialogTarget';

	interface Props {
		entries: ExplorerTreeEntry[];
		selectedFieldValue: string;
		onselect: (fieldValue: string) => void;
	}

	let { entries, selectedFieldValue, onselect }: Props = $props();

	const folderNodes = $derived(buildMoveFolderTree(entries));

	let expanded = $state<Record<string, boolean>>({});

	onMount(() => {
		const next: Record<string, boolean> = {};
		for (const path of defaultExpandedMoveFolderPaths(entries)) {
			next[path] = true;
		}
		expanded = next;
	});

	function toggleExpand(path: string, event: MouseEvent) {
		event.stopPropagation();
		expanded = { ...expanded, [path]: !expanded[path] };
	}

	function selectRoot() {
		onselect(PROJECT_ROOT_FIELD);
	}

	function selectFolder(node: MoveFolderTreeNode) {
		onselect(node.fieldValue);
	}

	function isExpanded(path: string): boolean {
		return expanded[path] ?? false;
	}
</script>

<div class="move-folder-tree" role="tree" aria-label="Project folders">
	<div class="tree-scroll">
		<ul class="tree-root" role="group">
			<li role="treeitem" aria-selected={selectedFieldValue === PROJECT_ROOT_FIELD}>
				<button
					type="button"
					class="row"
					class:selected={selectedFieldValue === PROJECT_ROOT_FIELD}
					onclick={selectRoot}
				>
					<span class="chevron placeholder" aria-hidden="true"></span>
					<span class="icon" aria-hidden="true">📁</span>
					<span class="label">{PROJECT_ROOT_FIELD}</span>
				</button>
				{#if folderNodes.length > 0}
					<ul role="group">
						{#each folderNodes as node (node.path)}
							{@render folderNode(node, 0)}
						{/each}
					</ul>
				{/if}
			</li>
		</ul>
	</div>
</div>

{#snippet folderNode(node: MoveFolderTreeNode, depth: number)}
	<li role="treeitem" aria-expanded={node.children.length > 0 ? isExpanded(node.path) : undefined} aria-selected={selectedFieldValue === node.fieldValue}>
		<div
			class="row"
			class:selected={selectedFieldValue === node.fieldValue}
			style="padding-left: {8 + depth * 14}px"
		>
			{#if node.children.length > 0}
				<button
					type="button"
					class="chevron-btn"
					aria-label={isExpanded(node.path) ? 'Collapse' : 'Expand'}
					onclick={(e) => toggleExpand(node.path, e)}
				>
					<span class="chevron">{isExpanded(node.path) ? '▼' : '▶'}</span>
				</button>
			{:else}
				<span class="chevron placeholder" aria-hidden="true"></span>
			{/if}
			<button type="button" class="label-btn" onclick={() => selectFolder(node)}>
				<span class="icon" aria-hidden="true">📁</span>
				<span class="label">{node.name}</span>
			</button>
		</div>
		{#if node.children.length > 0 && isExpanded(node.path)}
			<ul role="group">
				{#each node.children as child (child.path)}
					{@render folderNode(child, depth + 1)}
				{/each}
			</ul>
		{/if}
	</li>
{/snippet}

<style>
	.move-folder-tree {
		margin-top: 4px;
	}
	.tree-scroll {
		max-height: 220px;
		overflow: auto;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		padding: 4px 0;
	}
	.tree-root,
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 2px;
		width: 100%;
		padding: 2px 4px;
		border-radius: 4px;
		font-size: 13px;
	}
	.row:hover,
	.row.selected {
		background: #eff6ff;
	}
	.label-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: 1;
		min-width: 0;
		text-align: left;
		border: 0;
		background: transparent;
		padding: 2px 4px;
		cursor: pointer;
		font-size: inherit;
	}
	.chevron-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		flex-shrink: 0;
		border-radius: 4px;
	}
	.chevron-btn:hover {
		background: #e2e8f0;
	}
	.chevron {
		font-size: 10px;
		color: #64748b;
		width: 14px;
		text-align: center;
		flex-shrink: 0;
	}
	.chevron.placeholder {
		display: inline-block;
	}
	.icon {
		flex-shrink: 0;
		font-size: 14px;
	}
	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
