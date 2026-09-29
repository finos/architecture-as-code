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
	import { setExplorerTree, setSelectedExplorerPath } from '$lib/explorer/explorerTree.svelte';
	import type {
		CalmNodePreview,
		CalmNodeRefDragPayload,
		ExplorerFileEntry,
		ExplorerTreeEntry,
	} from '$lib/explorer/types';
	import { CALM_FILE_MOVE_MIME, CALM_NODE_REF_MIME } from '$lib/explorer/types';
	import {
		createProjectFile,
		getProjectLoadError,
		loadProjectFromRoot,
		projectNeedsCreate,
		getTemplateLoadWarnings,
	} from '$lib/project/projectStore.svelte';
	import CreateProjectDialog from '$lib/project/CreateProjectDialog.svelte';
	import ProjectSettingsDialog from '$lib/project/ProjectSettingsDialog.svelte';
	import PromptDialog from '$lib/ui/PromptDialog.svelte';
	import { getProjectConfig } from '$lib/project/projectStore.svelte';
	import {
		createProjectFolder,
		FolderMoveAbortedError,
		joinMoveDestination,
		moveProjectFile,
		moveProjectFolder,
	} from '$lib/explorer/folderMove';
	import {
		defaultNewFolderName,
		selectedDirectoryPath,
		validateFileName,
		validateFolderName,
	} from '$lib/explorer/folderName';
	import { createEmptyCalmFile } from '$lib/explorer/newFile';
	import {
		treeMenuDirectory,
		treeMenuShowsMove,
		type TreeMenuTarget,
	} from '$lib/explorer/treeMenu';
	import ExplorerContextMenu from '$lib/explorer/ExplorerContextMenu.svelte';
	import { listJsonFilesInTree, findDirectoryInTree } from '$lib/explorer/folderScan';
	import {
		PROJECT_ROOT_FIELD,
		fileMoveDestination,
		folderPathFromMoveField,
	} from '$lib/explorer/moveDialogTarget';
	import { splitRelativePath } from '$lib/project/projectFs';

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
		onhubbrowse?: () => void;
		onbeforefoldermove?: (movedPaths: string[]) => boolean;
		onfoldermove?: (mapping: Record<string, string>, sourcePrefix: string, destPrefix: string) => void;
	}

	let { currentFileRelativePath = null, onopenfile, onprojectchange, onhubbrowse, onbeforefoldermove, onfoldermove }: Props = $props();

	let rootHandle = $state<FileSystemDirectoryHandle | null>(null);
	let tree = $state<ExplorerTreeEntry[]>([]);
	let expandedDirs = $state<Record<string, boolean>>({});
	let expandedFiles = $state<Record<string, boolean>>({});
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);
	let promptError = $state('');
	let revealedPath = $state<string | null>(null);
	let revealToast = $state<string | null>(null);
	let showCreateProject = $state(false);
	let showProjectSettings = $state(false);
	let selectedPath = $state<string | null>(null);
	let folderPrompt = $state<
		| { kind: 'create'; parent: string; value: string }
		| { kind: 'create-file'; parent: string; value: string }
		| { kind: 'move'; source: string; name: string; destParent: string }
		| { kind: 'move-file'; source: string; name: string; destParent: string }
		| null
	>(null);
	let treeMenu = $state<{ x: number; y: number; target: TreeMenuTarget } | null>(null);

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

	function selectPath(path: string) {
		selectedPath = path;
		setSelectedExplorerPath(path);
	}

	function selectedFolder(): string {
		return selectedDirectoryPath(selectedPath);
	}

	function closeTreeMenu() {
		treeMenu = null;
	}

	function openTreeMenu(event: MouseEvent, target: TreeMenuTarget) {
		if (!rootHandle) return;
		event.preventDefault();
		event.stopPropagation();
		if (target.kind === 'empty') {
			selectedPath = null;
			setSelectedExplorerPath(null);
		} else {
			selectPath(target.path);
		}
		treeMenu = { x: event.clientX, y: event.clientY, target };
	}

	function handleExplorerContextMenu(event: MouseEvent) {
		if (!rootHandle) return;
		openTreeMenu(event, { kind: 'empty' });
	}

	function handleWindowClick() {
		if (treeMenu) closeTreeMenu();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && treeMenu) closeTreeMenu();
	}

	function openNewFolderPrompt(parent = selectedFolder()) {
		if (!rootHandle) return;
		closeTreeMenu();
		folderPrompt = {
			kind: 'create',
			parent,
			value: defaultNewFolderName(getProjectConfig()),
		};
	}

	function openNewFilePrompt(parent = selectedFolder()) {
		if (!rootHandle) return;
		closeTreeMenu();
		folderPrompt = {
			kind: 'create-file',
			parent,
			value: '',
		};
	}

	function openMoveFilePrompt(sourcePath: string) {
		if (!rootHandle) return;
		closeTreeMenu();
		const file = findFileInTree(tree, sourcePath);
		if (!file) {
			errorMessage = 'Select a file to move';
			return;
		}
		promptError = '';
		folderPrompt = {
			kind: 'move-file',
			source: file.relativePath,
			name: file.name,
			destParent: file.relativePath,
		};
	}

	function openMovePrompt(sourcePath = selectedPath) {
		if (!rootHandle || !sourcePath) return;
		closeTreeMenu();
		const dir = findDirectoryInTree(tree, sourcePath);
		if (!dir) {
			errorMessage = 'Select a folder to move';
			return;
		}
		promptError = '';
		const { dir: parent } = splitRelativePath(dir.relativePath);
		folderPrompt = {
			kind: 'move',
			source: dir.relativePath,
			name: dir.name,
			destParent: parent,
		};
	}

	async function runFileMove(sourcePath: string, destPath: string): Promise<boolean> {
		if (!rootHandle) return false;
		if (onbeforefoldermove && !onbeforefoldermove([sourcePath])) return false;
		const result = await moveProjectFile({
			root: rootHandle,
			sourcePath,
			destPath,
			files: listJsonFilesInTree(tree),
		});
		tree = await scanDirectoryTree(rootHandle);
		setExplorerTree(tree);
		const destParent = destPath.includes('/') ? destPath.slice(0, destPath.lastIndexOf('/')) : '';
		const nextExpanded = { ...expandedDirs };
		if (destParent) {
			for (const dir of ancestorDirPaths(destPath)) nextExpanded[dir] = true;
		}
		expandedDirs = nextExpanded;
		selectPath(destPath);
		onfoldermove?.(result.mapping, sourcePath, destPath);
		onprojectchange?.();
		return true;
	}

	function handleFileMoveDragStart(event: DragEvent, relativePath: string) {
		event.stopPropagation();
		event.dataTransfer?.setData(CALM_FILE_MOVE_MIME, relativePath);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function handleDirDragOver(event: DragEvent) {
		const types = event.dataTransfer?.types;
		if (!types || ![...types].includes(CALM_FILE_MOVE_MIME)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
	}

	async function handleDirDrop(event: DragEvent, dirPath: string) {
		const source = event.dataTransfer?.getData(CALM_FILE_MOVE_MIME);
		if (!source) return;
		event.preventDefault();
		event.stopPropagation();
		const name = source.split('/').pop() ?? source;
		const dest = dirPath ? `${dirPath}/${name}` : name;
		try {
			await runFileMove(source, dest);
		} catch (e) {
			errorMessage = (e as Error).message;
		}
	}

	async function confirmFolderPrompt(value: string, extra?: string) {
		if (!rootHandle || !folderPrompt) return;
		const prompt = folderPrompt;
		try {
			if (prompt.kind === 'move-file') {
				const dest = fileMoveDestination(value, extra ?? '');
				const fileName = dest.split('/').pop() ?? dest;
				const nameErr = validateFileName(fileName);
				if (!dest || nameErr) {
					promptError = nameErr ?? 'Destination is required';
					return;
				}
				if (dest === prompt.source) {
					promptError = 'Destination is the same as the source';
					return;
				}
				promptError = '';
				const moved = await runFileMove(prompt.source, dest);
				if (moved) {
					promptError = '';
					folderPrompt = null;
				}
				return;
			}
			if (prompt.kind === 'create') {
				const err = validateFolderName(value);
				if (err) {
					errorMessage = err;
					return;
				}
				const created = await createProjectFolder(rootHandle, prompt.parent, value);
				expandedDirs = { ...expandedDirs, [prompt.parent]: true, [created]: true };
				selectPath(created);
				folderPrompt = null;
				tree = await scanDirectoryTree(rootHandle);
				setExplorerTree(tree);
				onprojectchange?.();
				return;
			}

			if (prompt.kind === 'create-file') {
				const err = validateFileName(value);
				if (err) {
					errorMessage = err;
					return;
				}
				let created: { relativePath: string; handle: FileSystemFileHandle; content: string };
				try {
					created = await createEmptyCalmFile({
						root: rootHandle,
						parentDir: prompt.parent,
						fileName: value,
						overwrite: false,
					});
				} catch (e) {
					if (e instanceof FolderMoveAbortedError && e.message.startsWith('File already exists')) {
						const overwrite = window.confirm(`${e.message}. Overwrite?`);
						if (!overwrite) return;
						created = await createEmptyCalmFile({
							root: rootHandle,
							parentDir: prompt.parent,
							fileName: value,
							overwrite: true,
						});
					} else {
						throw e;
					}
				}
				if (prompt.parent) {
					expandedDirs = { ...expandedDirs, [prompt.parent]: true };
				}
				selectPath(created.relativePath);
				folderPrompt = null;
				tree = await scanDirectoryTree(rootHandle);
				setExplorerTree(tree);
				const fileName = created.relativePath.split('/').pop() ?? created.relativePath;
				onopenfile?.(created.content, fileName, created.relativePath, created.handle);
				onprojectchange?.();
				return;
			}

			const sourcePrefix = prompt.source;
			const destParent = folderPathFromMoveField(extra ?? '');
			const destNameErr = validateFolderName(value);
			if (destNameErr) {
				errorMessage = destNameErr;
				return;
			}
			const dest = joinMoveDestination(destParent, value);
			const movedPaths = listJsonFilesInTree(tree)
				.filter(
					(file) =>
						file.relativePath === sourcePrefix ||
						file.relativePath.startsWith(`${sourcePrefix}/`)
				)
				.map((file) => file.relativePath);
			if (onbeforefoldermove && !onbeforefoldermove(movedPaths)) return;
			let mapping: Record<string, string> = {};
			try {
				const result = await moveProjectFolder({
					root: rootHandle,
					sourcePrefix,
					destPrefix: dest,
					files: listJsonFilesInTree(tree),
					overwrite: false,
				});
				mapping = result.mapping;
			} catch (e) {
				if (e instanceof FolderMoveAbortedError && e.message.startsWith('Destination already exists')) {
					const overwrite = window.confirm(`${e.message}. Overwrite?`);
					if (!overwrite) return;
					const result = await moveProjectFolder({
						root: rootHandle,
						sourcePrefix,
						destPrefix: dest,
						files: listJsonFilesInTree(tree),
						overwrite: true,
					});
					mapping = result.mapping;
				} else {
					throw e;
				}
			}
			folderPrompt = null;
			tree = await scanDirectoryTree(rootHandle);
			setExplorerTree(tree);
			selectPath(dest);
			onfoldermove?.(mapping, sourcePrefix, dest);
			onprojectchange?.();
		} catch (e) {
			const message = (e as Error).message;
			promptError = message;
			errorMessage = message;
		}
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="file-explorer" oncontextmenu={handleExplorerContextMenu}>
	<div class="header" oncontextmenu={(e) => e.stopPropagation()}>
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
		{#if onhubbrowse}
			<button
				type="button"
				class="settings-btn"
				onclick={onhubbrowse}
				title="Browse CALM Hub"
				aria-label="Browse CALM Hub"
			>
				Hub
			</button>
		{/if}
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

	{#each getTemplateLoadWarnings() as warning}
		<p class="hint warning" role="status">{warning}</p>
	{/each}

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

{#if folderPrompt?.kind === 'create'}
	<PromptDialog
		title="New folder"
		label="Folder name"
		value={folderPrompt.value}
		hint={folderPrompt.parent ? `Created under ${folderPrompt.parent}` : 'Created at project root'}
		confirmLabel="Create"
		onconfirm={(value) => void confirmFolderPrompt(value)}
		oncancel={() => (folderPrompt = null)}
	/>
{/if}

{#if folderPrompt?.kind === 'create-file'}
	<PromptDialog
		title="New file"
		label="File name"
		value={folderPrompt.value}
		placeholder="architecture.json"
		hint={folderPrompt.parent ? `Created under ${folderPrompt.parent}` : 'Created at project root'}
		confirmLabel="Create"
		onconfirm={(value) => void confirmFolderPrompt(value)}
		oncancel={() => (folderPrompt = null)}
	/>
{/if}

{#if folderPrompt?.kind === 'move-file'}
	<PromptDialog
		title="Move file"
		label="Destination path"
		value={folderPrompt.destParent}
		error={promptError}
		hint={`Edit the path, or set only a destination folder. Moving ${folderPrompt.source}.`}
		extraLabel="Destination folder (project-relative)"
		extraValue=""
		folderTree={tree}
		confirmLabel="Move"
		onconfirm={(value, extra) => void confirmFolderPrompt(value, extra)}
		oncancel={() => {
			promptError = '';
			folderPrompt = null;
		}}
	/>
{/if}

{#if folderPrompt?.kind === 'move'}
	<PromptDialog
		title="Move folder"
		label="Folder name"
		value={folderPrompt.name}
		error={promptError}
		hint={`Moving ${folderPrompt.source}`}
		extraLabel="Destination parent (project-relative)"
		extraValue={folderPrompt.destParent || PROJECT_ROOT_FIELD}
		folderTree={tree}
		confirmLabel="Move"
		onconfirm={(value, extra) => void confirmFolderPrompt(value, extra)}
		oncancel={() => (folderPrompt = null)}
	/>
{/if}

{#if treeMenu}
	<ExplorerContextMenu
		x={treeMenu.x}
		y={treeMenu.y}
		showMove={treeMenuShowsMove(treeMenu.target)}
		onnewfolder={() => {
			const menu = treeMenu;
			if (!menu) return;
			openNewFolderPrompt(treeMenuDirectory(menu.target));
		}}
		onnewfile={() => {
			const menu = treeMenu;
			if (!menu) return;
			openNewFilePrompt(treeMenuDirectory(menu.target));
		}}
		onmove={() => {
			const menu = treeMenu;
			if (!menu) return;
			if (menu.target.kind === 'file') openMoveFilePrompt(menu.target.path);
			else if (menu.target.kind === 'directory') openMovePrompt(menu.target.path);
		}}
	/>
{/if}

{#snippet treeEntry(entry: ExplorerTreeEntry, depth: number)}
	<li class="tree-item" style="padding-left: {depth * 12}px" role="none">
		{#if entry.kind === 'directory'}
			<button
				type="button"
				class="tree-row directory"
				class:selected={selectedPath === entry.relativePath}
				role="treeitem"
				aria-expanded={expandedDirs[entry.relativePath] ?? false}
				onclick={() => {
					selectPath(entry.relativePath);
					toggleDir(entry.relativePath);
				}}
				ondragover={handleDirDragOver}
				ondrop={(e) => void handleDirDrop(e, entry.relativePath)}
				oncontextmenu={(e) => openTreeMenu(e, { kind: 'directory', path: entry.relativePath })}
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
					class:selected={selectedPath === entry.relativePath}
					data-relative-path={entry.relativePath}
					role="treeitem"
					onclick={() => selectPath(entry.relativePath)}
					oncontextmenu={(e) => openTreeMenu(e, { kind: 'file', path: entry.relativePath })}
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
						draggable="true"
						ondragstart={(e) => handleFileMoveDragStart(e, entry.relativePath)}
						ondblclick={() => handleFileDblClick(entry)}
						title="Double-click to open. Drag onto a folder to move."
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

	.hint.warning {
		color: #b45309;
		background: rgba(245, 158, 11, 0.1);
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

	.tree-row.selected {
		background: rgba(59, 130, 246, 0.18);
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
