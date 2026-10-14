<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { listHubAdrs, listHubNamespaces, type HubAdrSummary } from '$lib/hub/hubClient';

	interface Props {
		hubUrl: string | null;
		onconfirm: (url: string) => void;
		oncancel: () => void;
	}

	let { hubUrl, onconfirm, oncancel }: Props = $props();

	let namespaces = $state<string[]>([]);
	let selectedNs = $state('');
	let adrs = $state<HubAdrSummary[]>([]);
	let error = $state<string | null>(null);
	let loading = $state(false);

	$effect(() => {
		if (!hubUrl) return;
		loading = true;
		error = null;
		void listHubNamespaces(hubUrl)
			.then((items) => {
				namespaces = items.map((item) => item.name);
			})
			.catch((e: unknown) => {
				error = e instanceof Error ? e.message : 'Could not list Hub namespaces';
			})
			.finally(() => {
				loading = false;
			});
	});

	async function chooseNamespace(namespace: string) {
		if (!hubUrl) return;
		selectedNs = namespace;
		loading = true;
		error = null;
		try {
			adrs = await listHubAdrs(hubUrl, namespace);
		} catch (e) {
			adrs = [];
			error = e instanceof Error ? e.message : 'Could not list ADRs';
		} finally {
			loading = false;
		}
	}
</script>

<div class="backdrop" role="presentation">
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="hub-adr-title">
		<h2 id="hub-adr-title">Add ADR from Hub</h2>
		{#if !hubUrl}
			<p class="error" role="alert">Set a Hub URL in project settings first.</p>
		{:else if loading}
			<p>Loading…</p>
		{/if}
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
		{#if hubUrl}
			<div class="cols">
				<ul>
					{#each namespaces as namespace (namespace)}
						<li>
							<button type="button" class:selected={namespace === selectedNs} onclick={() => void chooseNamespace(namespace)}>
								{namespace}
							</button>
						</li>
					{/each}
				</ul>
				<ul>
					{#each adrs as adr (adr.id)}
						<li>
							<button type="button" onclick={() => onconfirm(adr.url)}>
								{adr.title}{adr.status ? ` (${adr.status})` : ''}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		<div class="actions">
			<button type="button" onclick={oncancel}>Cancel</button>
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
		width: min(640px, calc(100vw - 32px));
		max-height: min(70vh, 560px);
		overflow: auto;
		padding: 16px 18px;
		border-radius: 10px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
	}

	.cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	button {
		font: inherit;
		font-size: 12px;
	}

	li button {
		width: 100%;
		text-align: left;
		border: none;
		background: transparent;
		padding: 4px 6px;
		cursor: pointer;
	}

	.selected {
		background: rgba(59, 130, 246, 0.12);
	}

	.error {
		color: #b91c1c;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 12px;
	}
</style>
