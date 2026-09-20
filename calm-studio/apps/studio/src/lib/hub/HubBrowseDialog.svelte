<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { onMount } from 'svelte';
	import { getProjectConfig } from '$lib/project/projectStore.svelte';
	import { hubUrlFromProject } from './hubUrl';
	import {
		fetchHubArchitecture,
		hubArchitectureUrl,
		listHubArchitectures,
		listHubArchitectureVersions,
		listHubNamespaces,
		type HubArchitectureSummary,
		type HubNamespace,
	} from './hubClient';

	interface Props {
		oninsert: (ref: { id: string; name: string; url: string; architecture?: object }) => void;
		onopen?: (architecture: object, url: string, name: string) => void;
		oncancel: () => void;
		insertDisabled?: boolean;
	}

	let { oninsert, onopen, oncancel, insertDisabled = false }: Props = $props();

	const hubUrl = $derived(hubUrlFromProject(getProjectConfig()));

	let namespaces = $state<HubNamespace[]>([]);
	let architectures = $state<HubArchitectureSummary[]>([]);
	let versions = $state<string[]>([]);
	let selectedNs = $state<string | null>(null);
	let selectedArch = $state<HubArchitectureSummary | null>(null);
	let selectedVersion = $state<string | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	onMount(() => {
		void loadNamespaces();
	});

	async function loadNamespaces() {
		if (!hubUrl) {
			error = 'Set hub.url in Project settings first';
			return;
		}
		loading = true;
		error = null;
		try {
			namespaces = await listHubNamespaces(hubUrl);
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	async function selectNamespace(name: string) {
		selectedNs = name;
		selectedArch = null;
		selectedVersion = null;
		versions = [];
		architectures = [];
		if (!hubUrl) return;
		loading = true;
		error = null;
		try {
			architectures = await listHubArchitectures(hubUrl, name);
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	async function selectArchitecture(item: HubArchitectureSummary) {
		selectedArch = item;
		selectedVersion = item.version ?? null;
		if (!hubUrl || !selectedNs) return;
		loading = true;
		error = null;
		try {
			versions = await listHubArchitectureVersions(hubUrl, selectedNs, item.id);
			selectedVersion = versions[0] ?? item.version ?? '1.0.0';
		} catch (e) {
			error = (e as Error).message;
			versions = item.version ? [item.version] : ['1.0.0'];
			selectedVersion = versions[0] ?? null;
		} finally {
			loading = false;
		}
	}

	function currentUrl(): string | null {
		if (!hubUrl || !selectedNs || !selectedArch || !selectedVersion) return null;
		return hubArchitectureUrl(hubUrl, selectedNs, selectedArch.id, selectedVersion);
	}

	function handleInsert() {
		if (insertDisabled) return;
		const url = currentUrl();
		if (!url || !selectedArch) return;
		oninsert({
			id: selectedArch.id,
			name: selectedArch.name,
			url,
		});
	}

	async function handleOpen() {
		const url = currentUrl();
		if (!url || !selectedArch || !onopen) return;
		try {
			const architecture = await fetchHubArchitecture(url);
			onopen(architecture, url, selectedArch.name);
		} catch (e) {
			error = (e as Error).message;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			oncancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && oncancel()}>
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="hub-browse-title">
		<h2 id="hub-browse-title" class="title">CALM Hub</h2>
		<p class="meta">{hubUrl ?? 'No Hub URL configured'}</p>

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
		{#if loading}
			<p class="hint">Loading…</p>
		{/if}

		<div class="columns">
			<div class="col">
				<h3 class="col-title">Namespaces</h3>
				<ul class="list">
					{#each namespaces as ns (ns.name)}
						<li>
							<button
								type="button"
								class="item"
								class:active={selectedNs === ns.name}
								onclick={() => void selectNamespace(ns.name)}
							>
								{ns.name}
							</button>
						</li>
					{/each}
					{#if namespaces.length === 0 && !loading}
						<li class="empty">No namespaces</li>
					{/if}
				</ul>
			</div>
			<div class="col">
				<h3 class="col-title">Architectures</h3>
				<ul class="list">
					{#each architectures as arch (arch.id)}
						<li>
							<button
								type="button"
								class="item"
								class:active={selectedArch?.id === arch.id}
								onclick={() => void selectArchitecture(arch)}
							>
								{arch.name}
							</button>
						</li>
					{/each}
					{#if selectedNs && architectures.length === 0 && !loading}
						<li class="empty">No architectures</li>
					{/if}
				</ul>
			</div>
			<div class="col">
				<h3 class="col-title">Versions</h3>
				<ul class="list">
					{#each versions as version (version)}
						<li>
							<button
								type="button"
								class="item"
								class:active={selectedVersion === version}
								onclick={() => (selectedVersion = version)}
							>
								{version}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<div class="actions">
			<button type="button" class="btn" onclick={oncancel}>Cancel</button>
			{#if onopen}
				<button type="button" class="btn" onclick={() => void handleOpen()} disabled={!currentUrl()}>
					Open read-only
				</button>
			{/if}
			<button type="button" class="btn primary" onclick={handleInsert} disabled={!currentUrl() || insertDisabled}>
				Insert reference
			</button>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(15, 23, 42, 0.45);
	}
	.dialog {
		width: min(720px, calc(100vw - 32px));
		max-height: calc(100vh - 48px);
		overflow: auto;
		padding: 20px 22px;
		border-radius: 10px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18);
	}
	.title {
		margin: 0 0 6px;
		font-size: 16px;
		font-weight: 600;
	}
	.meta,
	.hint,
	.empty {
		font-size: 12px;
		color: #64748b;
	}
	.error {
		font-size: 12px;
		color: #b91c1c;
	}
	.columns {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 12px;
		margin: 12px 0 16px;
		min-height: 220px;
	}
	.col-title {
		margin: 0 0 8px;
		font-size: 12px;
		font-weight: 600;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		max-height: 260px;
		overflow: auto;
	}
	.item {
		width: 100%;
		text-align: left;
		padding: 8px 10px;
		border: none;
		background: transparent;
		font-size: 12px;
		cursor: pointer;
	}
	.item.active,
	.item:hover {
		background: #eff6ff;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	.btn {
		padding: 7px 14px;
		border-radius: 6px;
		border: 1px solid #cbd5e1;
		background: #fff;
		font-size: 12px;
		cursor: pointer;
	}
	.btn.primary {
		background: #2563eb;
		border-color: #2563eb;
		color: #fff;
	}
	.btn:disabled {
		opacity: 0.5;
	}
</style>
