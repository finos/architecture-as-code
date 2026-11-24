<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { subscribePackRegistry } from '@calmstudio/extensions';
	import { getProjectConfig } from '$lib/project/projectStore.svelte';
	import { CALM_NODE_REF_MIME, type CalmNodeRefDragPayload } from '$lib/explorer/types';
	import { hubNodeInsertHref } from '$lib/explorer/definingHref';
	import { hubUrlFromProject } from './hubUrl';
	import {
		fetchHubArchitecture,
		hubArchitectureUrl,
		listHubArchitectures,
		listHubArchitectureVersions,
		listHubNamespaces,
		type HubArchitectureSummary,
	} from './hubClient';
	import { hubNodesFromArchitecture, nodeTypeIconMarkup, type HubTreeNodePreview } from './hubNodes';

	interface Props {
		onopenversion?: (url: string, name: string) => void;
	}

	let { onopenversion }: Props = $props();

	const hubUrl = $derived(hubUrlFromProject(getProjectConfig()));

	let namespaces = $state<string[]>([]);
	let architectures = $state<Record<string, HubArchitectureSummary[]>>({});
	let versions = $state<Record<string, string[]>>({});
	let nodesByVersion = $state<Record<string, HubTreeNodePreview[]>>({});
	let openNs = $state<Record<string, boolean>>({});
	let openArch = $state<Record<string, boolean>>({});
	let openVersion = $state<Record<string, boolean>>({});
	let loading = $state<string | null>(null);
	let rowError = $state<Record<string, string>>({});
	let rootError = $state<string | null>(null);
	let packRevision = $state(0);
	let versionClickTimer: ReturnType<typeof setTimeout> | undefined;
	let scroller = $state<HTMLElement | null>(null);
	let selectedKey = $state<string | null>(null);

	onMount(() => subscribePackRegistry(() => {
		packRevision += 1;
	}));

	function archKey(ns: string, id: string): string {
		return `${ns}/${id}`;
	}

	function versionKey(ns: string, id: string, version: string): string {
		return `${ns}/${id}/${version}`;
	}

	// The panel stays mounted from startup, before a project is open.
	// Load namespaces when hub.url appears, not only on first mount.
	$effect(() => {
		const url = hubUrl;
		if (!url) {
			rootError = 'Set hub.url in Project settings first';
			namespaces = [];
			architectures = {};
			versions = {};
			nodesByVersion = {};
			return;
		}
		let cancelled = false;
		rootError = null;
		architectures = {};
		versions = {};
		nodesByVersion = {};
		openNs = {};
		openArch = {};
		openVersion = {};
		loading = 'root';
		void listHubNamespaces(url)
			.then((list) => {
				if (cancelled) return;
				namespaces = list.map((ns) => ns.name);
			})
			.catch((e: unknown) => {
				if (cancelled) return;
				rootError = e instanceof Error ? e.message : 'Failed to load namespaces';
			})
			.finally(() => {
				if (!cancelled) loading = null;
			});
		return () => {
			cancelled = true;
		};
	});

	async function toggleNamespace(name: string) {
		openNs = { ...openNs, [name]: !openNs[name] };
		if (!openNs[name] || architectures[name] || !hubUrl) return;
		loading = name;
		try {
			architectures = { ...architectures, [name]: await listHubArchitectures(hubUrl, name) };
			rowError = { ...rowError, [name]: '' };
		} catch (e) {
			rowError = { ...rowError, [name]: (e as Error).message };
		} finally {
			loading = null;
		}
	}

	async function toggleArchitecture(ns: string, arch: HubArchitectureSummary) {
		const key = archKey(ns, arch.id);
		openArch = { ...openArch, [key]: !openArch[key] };
		if (!openArch[key] || versions[key] || !hubUrl) return;
		loading = key;
		try {
			versions = {
				...versions,
				[key]: await listHubArchitectureVersions(hubUrl, ns, arch.id),
			};
			rowError = { ...rowError, [key]: '' };
		} catch (e) {
			rowError = { ...rowError, [key]: (e as Error).message };
		} finally {
			loading = null;
		}
	}

	async function toggleVersion(ns: string, arch: HubArchitectureSummary, version: string) {
		const key = versionKey(ns, arch.id, version);
		openVersion = { ...openVersion, [key]: !openVersion[key] };
		if (!openVersion[key] || nodesByVersion[key] || !hubUrl) return;
		loading = key;
		try {
			const url = hubArchitectureUrl(hubUrl, ns, arch.id, version);
			const doc = await fetchHubArchitecture(url);
			nodesByVersion = { ...nodesByVersion, [key]: hubNodesFromArchitecture(doc) };
			rowError = { ...rowError, [key]: '' };
		} catch (e) {
			rowError = { ...rowError, [key]: (e as Error).message };
		} finally {
			loading = null;
		}
	}

	async function refreshTree() {
		const url = hubUrl;
		if (!url) return;
		const scrollTop = scroller?.scrollTop ?? 0;
		loading = 'root';
		try {
			const list = await listHubNamespaces(url);
			namespaces = list.map((ns) => ns.name);
			const openNamespaces = { ...openNs };
			for (const ns of Object.keys(openNamespaces)) {
				if (!openNamespaces[ns]) continue;
				if (!namespaces.includes(ns)) {
					openNamespaces[ns] = false;
					continue;
				}
				architectures = { ...architectures, [ns]: await listHubArchitectures(url, ns) };
			}
			openNs = openNamespaces;
			const openArchitectures = { ...openArch };
			for (const key of Object.keys(openArchitectures)) {
				if (!openArchitectures[key]) continue;
				const slash = key.indexOf('/');
				const ns = key.slice(0, slash);
				const id = key.slice(slash + 1);
				const arch = (architectures[ns] ?? []).find((item) => item.id === id);
				if (!arch) {
					openArchitectures[key] = false;
					continue;
				}
				versions = { ...versions, [key]: await listHubArchitectureVersions(url, ns, arch.id) };
			}
			openArch = openArchitectures;
			const openVersions = { ...openVersion };
			for (const key of Object.keys(openVersions)) {
				if (!openVersions[key]) continue;
				const parts = key.split('/');
				const version = parts.pop() ?? '';
				const id = parts.pop() ?? '';
				const ns = parts.join('/');
				const arch = (architectures[ns] ?? []).find((item) => item.id === id);
				if (!arch || !(versions[archKey(ns, id)] ?? []).includes(version)) {
					openVersions[key] = false;
					continue;
				}
				const docUrl = hubArchitectureUrl(url, ns, arch.id, version);
				const doc = await fetchHubArchitecture(docUrl);
				nodesByVersion = { ...nodesByVersion, [key]: hubNodesFromArchitecture(doc) };
			}
			openVersion = openVersions;
			if (selectedKey && !selectionStillPresent(selectedKey)) selectedKey = null;
		} catch (e) {
			rootError = e instanceof Error ? e.message : 'Failed to refresh Hub';
		} finally {
			loading = null;
			await tick();
			if (scroller) scroller.scrollTop = scrollTop;
		}
	}

	function selectionStillPresent(key: string): boolean {
		if (namespaces.includes(key)) return true;
		for (const ns of namespaces) {
			if ((architectures[ns] ?? []).some((arch) => archKey(ns, arch.id) === key)) return true;
			for (const arch of architectures[ns] ?? []) {
				const aKey = archKey(ns, arch.id);
				if ((versions[aKey] ?? []).some((version) => versionKey(ns, arch.id, version) === key)) {
					return true;
				}
				for (const version of versions[aKey] ?? []) {
					const vKey = versionKey(ns, arch.id, version);
					if ((nodesByVersion[vKey] ?? []).some((node) => `${vKey}/${node.uniqueId}` === key)) {
						return true;
					}
				}
			}
		}
		return false;
	}

	function onVersionClick(ns: string, arch: HubArchitectureSummary, version: string) {
		clearTimeout(versionClickTimer);
		versionClickTimer = setTimeout(() => {
			void toggleVersion(ns, arch, version);
		}, 220);
	}

	function onVersionDblClick(ns: string, arch: HubArchitectureSummary, version: string) {
		clearTimeout(versionClickTimer);
		onopenversion?.(versionUrl(ns, arch, version), arch.name);
	}

	function versionUrl(ns: string, arch: HubArchitectureSummary, version: string): string {
		return hubUrl ? hubArchitectureUrl(hubUrl, ns, arch.id, version) : '';
	}

	function dragNode(
		event: DragEvent,
		node: HubTreeNodePreview,
		url: string
	) {
		const payload: CalmNodeRefDragPayload = {
			sourceRelativePath: url,
			nodeUniqueId: node.uniqueId,
			name: node.name,
			nodeType: node.nodeType,
			description: node.description,
			detailedArchitecture: hubNodeInsertHref(url, node.detailedArchitecture),
		};
		event.dataTransfer?.setData(CALM_NODE_REF_MIME, JSON.stringify(payload));
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
	}

	function iconMarkup(nodeType: string): string {
		void packRevision;
		return nodeTypeIconMarkup(nodeType);
	}
</script>

<div class="hub-tree" bind:this={scroller}>
	<div class="toolbar">
		<button type="button" class="refresh" onclick={() => void refreshTree()} disabled={!hubUrl || loading === 'root'}>
			Refresh
		</button>
	</div>
	{#if rootError}
		<p class="error" role="alert">{rootError}</p>
	{/if}
	{#if loading === 'root'}
		<p class="hint">Loading namespaces…</p>
	{/if}
	<ul class="tree" role="tree">
		{#each namespaces as ns (ns)}
			<li>
				<button type="button" class="row" class:selected={selectedKey === ns} title={ns} onclick={() => { selectedKey = ns; void toggleNamespace(ns); }}>
					<span class="chevron">{openNs[ns] ? '▼' : '▶'}</span>
					<span class="label">{ns}</span>
				</button>
				{#if rowError[ns]}
					<p class="error">{rowError[ns]}</p>
				{/if}
				{#if openNs[ns]}
					<ul>
						{#each architectures[ns] ?? [] as arch (arch.id)}
							{@const aKey = archKey(ns, arch.id)}
							<li>
								<button type="button" class="row" class:selected={selectedKey === aKey} title={arch.name} onclick={() => { selectedKey = aKey; void toggleArchitecture(ns, arch); }}>
									<span class="chevron">{openArch[aKey] ? '▼' : '▶'}</span>
									<span class="label">{arch.name}</span>
								</button>
								{#if rowError[aKey]}
									<p class="error">{rowError[aKey]}</p>
								{/if}
								{#if openArch[aKey]}
									<ul>
										{#each versions[aKey] ?? [] as version (version)}
											{@const vKey = versionKey(ns, arch.id, version)}
											<li>
												<button
													type="button"
													class="row"
													title={version}
													class:selected={selectedKey === vKey}
													onclick={() => { selectedKey = vKey; onVersionClick(ns, arch, version); }}
													ondblclick={() => onVersionDblClick(ns, arch, version)}
												>
													<span class="chevron">{openVersion[vKey] ? '▼' : '▶'}</span>
													<span class="label">{version}</span>
												</button>
												{#if rowError[vKey]}
													<p class="error">{rowError[vKey]}</p>
												{/if}
												{#if openVersion[vKey]}
													<ul>
														{#each nodesByVersion[vKey] ?? [] as node (node.uniqueId)}
															<li>
																<div
																	class="row node"
																	role="button"
																	tabindex="0"
																	draggable="true"
																	title={node.name}
																	class:selected={selectedKey === `${vKey}/${node.uniqueId}`}
																	onclick={() => (selectedKey = `${vKey}/${node.uniqueId}`)}
																	ondragstart={(e) => dragNode(e, node, versionUrl(ns, arch, version))}
																>
																	{#if iconMarkup(node.nodeType)}
																		<span
																			class="pack-icon"
																			class:archimate-icon={node.nodeType.startsWith('archimate:')}
																		>{@html iconMarkup(node.nodeType)}</span>
																	{:else}
																		<span class="icon">○</span>
																	{/if}
																	<span class="label">{node.name}</span>
																</div>
															</li>
														{/each}
													</ul>
												{/if}
											</li>
										{/each}
									</ul>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.hub-tree {
		height: 100%;
		overflow: auto;
		padding: 8px;
		font-size: 12px;
	}

	.toolbar {
		position: sticky;
		top: 0;
		z-index: 1;
		margin-bottom: 6px;
		background: var(--color-surface-primary, #fff);
	}

	.refresh {
		font-size: 12px;
	}

	.row.selected {
		background: var(--color-surface-tertiary, rgba(0, 0, 0, 0.06));
	}

	.tree,
	.hub-tree ul {
		list-style: none;
		margin: 0;
		padding: 0 0 0 2ch;
	}

	.row {
		display: flex;
		gap: 4px;
		align-items: center;
		width: max-content;
		min-width: 100%;
		border: none;
		background: transparent;
		color: var(--color-text-primary);
		text-align: left;
		cursor: pointer;
		padding: 2px 4px;
	}

	.row.node {
		cursor: grab;
	}

	.chevron {
		width: 12px;
		color: var(--color-text-secondary);
	}

	.label {
		white-space: nowrap;
	}

	.icon {
		width: 14px;
		flex-shrink: 0;
	}

	.pack-icon {
		display: inline-flex;
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		color: var(--color-text-primary);
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

	.error {
		color: var(--color-danger, #b91c1c);
		margin: 2px 0 2px 16px;
		font-size: 11px;
	}

	.hint {
		color: var(--color-text-secondary);
		margin: 4px;
	}
</style>
