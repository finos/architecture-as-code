<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolvePackNode } from '@calmstudio/extensions';
	import {
		ensureReadPermission,
		ensureReadWritePermission,
		isDirectoryPickerSupported,
		loadRootDirectoryHandle,
		saveRootDirectoryHandle,
	} from '$lib/explorer/folderPersistence';
	import {
		loadCalmNodesForFile,
		readFileContent,
		scanDirectoryTree,
		updateFileInTree,
		findFileInTree,
	} from '$lib/explorer/folderScan';
	import { setExplorerTree } from '$lib/explorer/explorerTree.svelte';
	import type {
		CalmNodePreview,
		CalmNodeRefDragPayload,
		ExplorerFileEntry,
		ExplorerTreeEntry,
	} from '$lib/explorer/types';
	import { CALM_NODE_REF_MIME } from '$lib/explorer/types';
	import {
		createProjectFile,
		getProjectLoadError,
		loadProjectFromRoot,
		projectNeedsCreate,
	} from '$lib/project/projectStore.svelte';
	import CreateProjectDialog from '$lib/project/CreateProjectDialog.svelte';
	import ProjectSettingsDialog from '$lib/project/ProjectSettingsDialog.svelte';

	interface Props {
		currentFileRelativePath?: string | null;
		onopenfile?: (
			content: string,
			name: string,
			relativePath: string,
			handle: FileSystemFileHandle
		) => void;
		/** Notify parent that project root/config changed (R24). */
		onprojectchange?: () => void;
	}

	let { currentFileRelativePath = null, onopenfile, onprojectchange }: Props = $props();

	let rootHandle = $state<FileSystemDirectoryHandle | null>(null);
	let tree = $state<ExplorerTreeEntry[]>([]);
	let expandedDirs = $state<Record<string, boolean>>({});
	let expandedFiles = $state<Record<string, boolean>>({});
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);
	let revealedPath = $state<string | null>(null);
	let revealToast = $state<string | null>(null);
	let showCreateProject = $state(false);
	let showProjectSettings = $state(false);

	const fsSupported = isDirectoryPickerSupported();

	const canReveal = $derived(
		!!currentFileRelativePath && tree.length > 0 && !!findFileInTree(tree, currentFileRelativePath)
	);

	onMount(() => {
		void restorePersistedFolder();
	});

	async function restorePersistedFolder() {
		if (!fsSupported) return;
		try {
			const handle = await loadRootDirectoryHandle();
			if (!handle) return;
			const ok = await ensureReadPermission(handle);
			if (!ok) {
				errorMessage = 'Folder access expired. Open the folder again.';
				return;
			}
			await loadTree(handle);
		} catch {
			errorMessage = 'Could not restore folder access.';
		}
	}

	async function loadTree(handle: FileSystemDirectoryHandle) {
		loading = true;
		errorMessage = null;
		try {
			rootHandle = handle;
			tree = await scanDirectoryTree(handle);
			setExplorerTree(tree);
			await saveRootDirectoryHandle(handle);
			const status = await loadProjectFromRoot(handle);
			if (status === 'multiple' || status === 'invalid') {
				errorMessage = getProjectLoadError();
			} else if (status === 'missing') {
				showCreateProject = true;
			}
			onprojectchange?.();
		} catch (e) {
			errorMessage = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	async function handleOpenFolder() {
		if (!fsSupported) {
			errorMessage = 'Folder browsing requires Chrome or Safari.';
			return;
		}
		try {
			const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
			await ensureReadWritePermission(handle);
			await loadTree(handle);
		} catch (e) {
			if ((e as Error).name !== 'AbortError') {
				errorMessage = (e as Error).message;
			}
		}
	}

	async function handleCreateProject(result: { name: string; fileName: string }) {
		if (!rootHandle) return;
		try {
			await createProjectFile(rootHandle, result.name, result.fileName);
			showCreateProject = false;
			tree = await scanDirectoryTree(rootHandle);
			setExplorerTree(tree);
			onprojectchange?.();
		} catch (e) {
			errorMessage = (e as Error).message;
		}
	}

	/** Full tree rescan after extract creates new files (R27). */
	export async function rescanTree(): Promise<void> {
		if (!rootHandle) return;
		tree = await scanDirectoryTree(rootHandle);
		setExplorerTree(tree);
	}

	export function getRootHandle(): FileSystemDirectoryHandle | null {
		return rootHandle;
	}

	function toggleDir(path: string) {
		expandedDirs = { ...expandedDirs, [path]: !expandedDirs[path] };
	}

	async function toggleFile(file: ExplorerFileEntry) {
		const isOpen = expandedFiles[file.relativePath];
		if (!isOpen && !file.nodesLoaded) {
			const loaded = await loadCalmNodesForFile(file);
			tree = updateFileInTree(tree, file.relativePath, loaded);
			setExplorerTree(tree);
		}
		expandedFiles = { ...expandedFiles, [file.relativePath]: !isOpen };
	}

	async function handleFileDblClick(file: ExplorerFileEntry) {
		try {
			const content = await readFileContent(file);
			onopenfile?.(content, file.name, file.relativePath, file.handle);
		} catch (e) {
			errorMessage = (e as Error).message;
		}
	}

	function isCurrentFile(path: string): boolean {
		return !!currentFileRelativePath && currentFileRelativePath === path;
	}

	function canDragNode(filePath: string): boolean {
		return !isCurrentFile(filePath);
	}

	function handleNodeDragStart(event: DragEvent, file: ExplorerFileEntry, node: CalmNodePreview) {
		if (!canDragNode(file.relativePath)) {
			event.preventDefault();
			return;
		}
		const payload: CalmNodeRefDragPayload = {
			sourceRelativePath: file.relativePath,
			nodeUniqueId: node.uniqueId,
			name: node.name,
			nodeType: node.nodeType,
			description: node.description,
		};
		event.dataTransfer?.setData(CALM_NODE_REF_MIME, JSON.stringify(payload));
		event.dataTransfer!.effectAllowed = 'copy';
	}

	function nodeIconMarkup(nodeType: string): string {
		const pack = nodeType.includes(':') ? resolvePackNode(nodeType) : null;
		if (pack?.icon) {
			return pack.icon;
		}
		return '';
	}

	function ancestorDirPaths(relativePath: string): string[] {
		const parts = relativePath.split('/');
		const dirs: string[] = [];
		for (let i = 0; i < parts.length - 1; i++) {
			dirs.push(parts.slice(0, i + 1).join('/'));
		}
		return dirs;
	}

	/** R19 — expand ancestors, scroll to file, highlight. */
	export async function reveal(relativePath?: string | null): Promise<boolean> {
		const path = relativePath ?? currentFileRelativePath;
		if (!path) {
			revealToast = 'Current file is not in the open project folder.';
			setTimeout(() => {
				if (revealToast?.startsWith('Current file')) revealToast = null;
			}, 3000);
			return false;
		}
		if (!findFileInTree(tree, path)) {
			revealToast = 'Current file is not in the open project folder.';
			setTimeout(() => {
				if (revealToast?.startsWith('Current file')) revealToast = null;
			}, 3000);
			return false;
		}

		const dirs = ancestorDirPaths(path);
		const nextExpanded = { ...expandedDirs };
		for (const dir of dirs) {
			nextExpanded[dir] = true;
		}
		expandedDirs = nextExpanded;
		await tick();

		revealedPath = path;
		await tick();
		const el = document.querySelector(
			`.file-explorer [data-relative-path="${CSS.escape(path)}"]`
		);
		el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		setTimeout(() => {
			if (revealedPath === path) revealedPath = null;
		}, 2000);
		return true;
	}

	/** R20 — refresh node preview for a saved file without full tree rescan. */
	export async function refreshFileNodes(relativePath: string): Promise<void> {
		const file = findFileInTree(tree, relativePath);
		if (!file) return;
		const loaded = await loadCalmNodesForFile({ ...file, nodesLoaded: false });
		tree = updateFileInTree(tree, relativePath, loaded);
		setExplorerTree(tree);
	}

	export function hasFile(relativePath: string | null | undefined): boolean {
		return !!relativePath && !!findFileInTree(tree, relativePath);
	}
</script>

<div class="file-explorer">
	<div class="header">
		<button type="button" class="open-folder-btn" onclick={handleOpenFolder} disabled={!fsSupported}>
			Open folder…
		</button>
		<button
			type="button"
			class="reveal-btn"
			onclick={() => void reveal()}
			disabled={!canReveal}
			title={canReveal
				? 'Reveal active file in tree'
				: 'Current file is not in the open project folder'}
			aria-label="Reveal active file in tree"
		>
			⌖
		</button>
		<button
			type="button"
			class="settings-btn"
			onclick={() => (showProjectSettings = true)}
			disabled={!rootHandle}
			title="Project settings (.calmrj)"
			aria-label="Project settings"
		>
			⚙
		</button>
	</div>

	{#if revealToast}
		<p class="hint toast" role="status">{revealToast}</p>
	{/if}

	{#if projectNeedsCreate() && rootHandle && !showCreateProject}
		<p class="hint">
			<button type="button" class="linkish" onclick={() => (showCreateProject = true)}>Create project file…</button>
		</p>
	{/if}

	{#if errorMessage}
		<p class="error" role="alert">{errorMessage}</p>
	{/if}

	{#if !fsSupported}
		<p class="hint">Use Chrome or Safari for project folder browsing.</p>
	{:else if loading}
		<p class="hint">Loading…</p>
	{:else if tree.length === 0}
		<p class="hint">No folder selected. Open a project folder to browse CALM files.</p>
	{:else}
		<ul class="tree" role="tree">
			{#each tree as entry (entry.relativePath)}
				{@render treeEntry(entry, 0)}
			{/each}
		</ul>
	{/if}
</div>

{#if showCreateProject && rootHandle}
	<CreateProjectDialog
		defaultName={rootHandle.name || 'project'}
		onconfirm={(r) => void handleCreateProject(r)}
		oncancel={() => (showCreateProject = false)}
		onskip={() => (showCreateProject = false)}
	/>
{/if}

{#if showProjectSettings}
	<ProjectSettingsDialog onclose={() => (showProjectSettings = false)} />
{/if}

{#snippet treeEntry(entry: ExplorerTreeEntry, depth: number)}
	<li class="tree-item" style="padding-left: {depth * 12}px" role="none">
		{#if entry.kind === 'directory'}
			<button
				type="button"
				class="tree-row directory"
				role="treeitem"
				aria-expanded={expandedDirs[entry.relativePath] ?? false}
				onclick={() => toggleDir(entry.relativePath)}
			>
				<span class="chevron">{expandedDirs[entry.relativePath] ? '▼' : '▶'}</span>
				<span class="icon">📁</span>
				<span class="label">{entry.name}</span>
			</button>
			{#if expandedDirs[entry.relativePath]}
				<ul class="tree" role="group">
					{#each entry.children as child (child.relativePath)}
						{@render treeEntry(child, depth + 1)}
					{/each}
				</ul>
			{/if}
		{:else}
			<div class="file-block">
				<div
					class="tree-row file"
					class:current={isCurrentFile(entry.relativePath)}
					class:revealed={revealedPath === entry.relativePath}
					data-relative-path={entry.relativePath}
					role="treeitem"
				>
					<button
						type="button"
						class="chevron-btn"
						aria-label={expandedFiles[entry.relativePath] ? 'Collapse file' : 'Expand file'}
						aria-expanded={expandedFiles[entry.relativePath] ?? false}
						onclick={() => toggleFile(entry)}
					>
						<span class="chevron">{expandedFiles[entry.relativePath] ? '▼' : '▶'}</span>
					</button>
					<button
						type="button"
						class="file-open-btn"
						ondblclick={() => handleFileDblClick(entry)}
						title="Double-click to open"
					>
						<span class="icon">📄</span>
						<span class="label">{entry.name}</span>
					</button>
				</div>
				{#if expandedFiles[entry.relativePath] && entry.nodes && entry.nodes.length > 0}
					<ul class="node-list" role="group">
						{#each entry.nodes as node (node.uniqueId)}
							<li>
								<div
									class="tree-row node"
									class:disabled={!canDragNode(entry.relativePath)}
									role="treeitem"
									draggable={canDragNode(entry.relativePath)}
									ondragstart={(e) => handleNodeDragStart(e, entry, node)}
									title={canDragNode(entry.relativePath)
										? 'Drag to canvas to add reference'
										: 'Cannot reference nodes from the current file'}
								>
									{#if nodeIconMarkup(node.nodeType)}
										<span
											class="pack-icon"
											class:archimate-icon={node.nodeType.startsWith('archimate:')}
										>{@html nodeIconMarkup(node.nodeType)}</span>
									{:else}
										<span class="icon">○</span>
									{/if}
									<span class="label">{node.name}</span>
								</div>
							</li>
						{/each}
					</ul>
				{:else if expandedFiles[entry.relativePath] && entry.nodesLoaded && !entry.isCalm}
					<p class="non-calm">Not a CALM architecture file</p>
				{/if}
			</div>
		{/if}
	</li>
{/snippet}

<style>
	.file-explorer {
		display: flex;
		flex-direction: column;
		width: 100%;
		min-width: 0;
		height: 100%;
		flex: 1;
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
		overflow: hidden;
	}

	.header {
		display: flex;
		gap: 6px;
		padding: 8px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.open-folder-btn {
		flex: 1;
		padding: 6px 10px;
		font-size: 12px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-surface);
		cursor: pointer;
	}

	.open-folder-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.reveal-btn {
		flex-shrink: 0;
		width: 32px;
		padding: 6px 0;
		font-size: 14px;
		line-height: 1;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-surface);
		cursor: pointer;
		color: var(--color-text-secondary);
	}

	.reveal-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.reveal-btn:not(:disabled):hover {
		background: var(--color-surface-tertiary, rgba(0, 0, 0, 0.05));
		color: var(--color-text-primary);
	}

	.settings-btn {
		flex-shrink: 0;
		width: 32px;
		padding: 6px 0;
		font-size: 14px;
		line-height: 1;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-surface);
		cursor: pointer;
		color: var(--color-text-secondary);
	}

	.settings-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.settings-btn:not(:disabled):hover {
		background: var(--color-surface-tertiary, rgba(0, 0, 0, 0.05));
		color: var(--color-text-primary);
	}

	.linkish {
		background: none;
		border: none;
		padding: 0;
		color: var(--color-accent, #2563eb);
		cursor: pointer;
		font-size: inherit;
		text-decoration: underline;
	}

	.hint,
	.error {
		padding: 10px;
		font-size: 11px;
		color: var(--color-text-secondary);
	}

	.hint.toast {
		padding: 6px 10px;
		background: rgba(59, 130, 246, 0.08);
	}

	.error {
		color: #ef4444;
	}

	.tree {
		list-style: none;
		margin: 0;
		padding: 4px 0;
		overflow-y: auto;
		flex: 1;
	}

	.tree-item {
		margin: 0;
	}

	.tree-row {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		padding: 3px 6px;
		border: none;
		background: transparent;
		font-size: 11.5px;
		text-align: left;
		cursor: pointer;
		color: var(--color-text-primary);
		border-radius: 4px;
	}

	.tree-row:hover:not(.disabled) {
		background: var(--color-surface-tertiary, rgba(0, 0, 0, 0.05));
	}

	.tree-row.file {
		padding: 0;
		gap: 0;
	}

	.chevron-btn,
	.file-open-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border: none;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
		padding: 3px 4px;
		border-radius: 4px;
	}

	.file-open-btn {
		flex: 1;
		min-width: 0;
		text-align: left;
	}

	.chevron-btn:hover,
	.file-open-btn:hover {
		background: var(--color-surface-tertiary, rgba(0, 0, 0, 0.05));
	}

	.tree-row.file.current {
		background: rgba(59, 130, 246, 0.12);
		border-radius: 4px;
	}

	.tree-row.file.current .file-open-btn {
		font-weight: 600;
	}

	.tree-row.file.revealed {
		animation: reveal-pulse 1.2s ease-out;
		outline: 2px solid rgba(59, 130, 246, 0.55);
		outline-offset: 1px;
	}

	@keyframes reveal-pulse {
		0% {
			background: rgba(59, 130, 246, 0.35);
		}
		100% {
			background: rgba(59, 130, 246, 0.12);
		}
	}

	.tree-row.node {
		padding-left: 28px;
		cursor: grab;
	}

	.tree-row.node.disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.chevron {
		width: 12px;
		font-size: 8px;
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.icon {
		flex-shrink: 0;
	}

	.pack-icon {
		display: inline-flex;
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.pack-icon.archimate-icon {
		font-size: 11.5px;
		width: 2em;
		height: 2em;
	}

	.pack-icon :global(svg) {
		width: 14px;
		height: 14px;
	}

	.pack-icon.archimate-icon :global(svg) {
		width: 2em;
		height: 2em;
	}

	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.non-calm {
		margin: 0;
		padding: 2px 6px 2px 28px;
		font-size: 10px;
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.node-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
</style>
