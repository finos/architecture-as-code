<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  GemaraCatalogPicker.svelte — Modal for binding a Gemara control catalog (or
  individual controls) from grc.store to the selected element.

  Two ways in:
    - grc.store: enter a catalog coordinate (namespace / id / version) and fetch
      it from the hub.
    - Paste: paste an unpacked catalog (JSON) — the hub-down / CORS fallback.

  Once a catalog is loaded, the user either binds the whole catalog or selects
  individual controls; on Bind we build `gemara-link` decorators (applies-to the
  current element) and hand them back via onbind.

  There is NO signature/provenance verification (client-side fetch) — the bound
  decorators carry `verified: false` and the UI says so.
-->

<script lang="ts">
	import {
		buildGemaraDecorator,
		HubError,
		type CalmDecorator,
		type GemaraArtifactKind,
	} from '@calmstudio/calm-core';
	import { loadFromRef, loadFromPaste, type LoadedCatalog } from '$lib/stores/gemaraCatalogs';
	import { SHOW_VERIFICATION_STATUS } from '$lib/governance/verification';

	let {
		elementId,
		artifact,
		target,
		onbind,
		oncancel,
	}: {
		elementId: string;
		artifact: GemaraArtifactKind;
		target?: string[];
		onbind: (decorators: CalmDecorator[]) => void;
		oncancel: () => void;
	} = $props();

	const heading = $derived(artifact === 'guidance' ? 'Attach Guidance' : 'Attach Requirements');

	type Tab = 'grcstore' | 'paste';
	let tab = $state<Tab>('grcstore');

	let namespace = $state('');
	let catalogId = $state('');
	let version = $state('');
	let pasteText = $state('');

	let loading = $state(false);
	let error = $state<string | null>(null);
	let loaded = $state<LoadedCatalog | null>(null);

	const canFetch = $derived(
		namespace.trim() !== '' && catalogId.trim() !== '' && version.trim() !== '',
	);
	const canAttach = $derived(loaded !== null);

	function humanize(e: unknown): string {
		if (e instanceof HubError) {
			if (e.status === 410) return 'That version has been yanked.';
			return e.detail ? `${e.detail}` : `Hub error (${e.status}).`;
		}
		return e instanceof Error ? e.message : String(e);
	}

	async function handleFetch() {
		error = null;
		loaded = null;
		loading = true;
		try {
			loaded = await loadFromRef({
				namespace: namespace.trim(),
				catalogId: catalogId.trim(),
				version: version.trim(),
			});
		} catch (e) {
			error = humanize(e);
		} finally {
			loading = false;
		}
	}

	function handleParse() {
		error = null;
		loaded = null;
		try {
			loaded = loadFromPaste(pasteText);
		} catch (e) {
			error = humanize(e);
		}
	}

	function handleAttach() {
		if (!loaded) return;
		const targetOpt = target && target.length > 0 ? { target } : {};
		onbind([
			buildGemaraDecorator({
				artifact,
				kind: 'catalog',
				catalogRef: loaded.ref,
				appliesTo: [elementId],
				...targetOpt,
			}),
		]);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			oncancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay">
	<button type="button" class="backdrop" aria-label="Dismiss" onclick={oncancel}></button>
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="gemara-picker-title">
		<div class="header">
			<h2 id="gemara-picker-title">{heading}</h2>
			<button type="button" class="close-btn" onclick={oncancel} aria-label="Close">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
					<path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" />
				</svg>
			</button>
		</div>

		<div class="tabs" role="tablist">
			<button
				type="button"
				role="tab"
				class="tab"
				class:active={tab === 'grcstore'}
				aria-selected={tab === 'grcstore'}
				onclick={() => (tab = 'grcstore')}
			>grc.store</button>
			<button
				type="button"
				role="tab"
				class="tab"
				class:active={tab === 'paste'}
				aria-selected={tab === 'paste'}
				onclick={() => (tab = 'paste')}
			>Paste</button>
		</div>

		<div class="body">
			{#if tab === 'grcstore'}
				<div class="ref-form">
					<label class="field">
						<span class="field-label">Namespace</span>
						<input class="text-input" bind:value={namespace} placeholder="finos" />
					</label>
					<label class="field">
						<span class="field-label">Catalog ID</span>
						<input class="text-input" bind:value={catalogId} placeholder="mara-controls" />
					</label>
					<label class="field">
						<span class="field-label">Version</span>
						<input class="text-input" bind:value={version} placeholder="0.3.0" />
					</label>
					<button type="button" class="primary-btn" disabled={!canFetch || loading} onclick={handleFetch}>
						{loading ? 'Fetching…' : 'Fetch'}
					</button>
				</div>
			{:else}
				<div class="paste-form">
					<textarea
						class="paste-area"
						rows={8}
						bind:value={pasteText}
						placeholder="Paste a Gemara control catalog (YAML or JSON)…"
						aria-label="Catalog source"
					></textarea>
					<button type="button" class="primary-btn" disabled={pasteText.trim() === ''} onclick={handleParse}>
						Parse
					</button>
				</div>
			{/if}

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			{#if loaded}
				<div class="loaded">
					<div class="catalog-head">
						<span class="catalog-title">{loaded.title ?? loaded.ref.catalogId}</span>
						<span class="catalog-coord">{loaded.ref.namespace ? loaded.ref.namespace + '/' : ''}{loaded.ref.catalogId}@{loaded.ref.version}</span>
					</div>
					{#if SHOW_VERIFICATION_STATUS}<p class="unverified">⚠ Signature unverified — fetched client-side without provenance checks.</p>{/if}
				</div>
			{/if}
		</div>

		<div class="footer">
			<button type="button" class="secondary-btn" onclick={oncancel}>Cancel</button>
			<button type="button" class="primary-btn" disabled={!canAttach} onclick={handleAttach}>Attach</button>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(15, 23, 42, 0.55);
		backdrop-filter: blur(2px);
		padding: 24px;
	}

	.backdrop {
		position: absolute;
		inset: 0;
		border: none;
		margin: 0;
		padding: 0;
		background: transparent;
		cursor: default;
	}

	.dialog {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 460px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 10px;
		overflow: hidden;
		box-shadow: 0 20px 60px rgba(15, 23, 42, 0.3);
	}

	:global(.dark) .dialog {
		background: #111827;
		border-color: #334155;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border-bottom: 1px solid var(--color-border, #e2e8f0);
	}

	:global(.dark) .header {
		border-color: #1e293b;
	}

	.header h2 {
		margin: 0;
		font-size: 14px;
		font-weight: 700;
		color: var(--color-text-primary, #1e293b);
	}

	:global(.dark) .header h2 {
		color: #e2e8f0;
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		background: none;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		color: var(--color-text-tertiary, #94a3b8);
	}

	.close-btn:hover {
		background: var(--color-surface-secondary, #f1f5f9);
	}

	.tabs {
		display: flex;
		gap: 4px;
		padding: 8px 16px 0;
	}

	.tab {
		padding: 6px 12px;
		font-size: 12px;
		font-weight: 600;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		color: var(--color-text-tertiary, #94a3b8);
	}

	.tab.active {
		color: var(--color-accent, #6366f1);
		border-bottom-color: var(--color-accent, #6366f1);
	}

	.body {
		padding: 14px 16px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.ref-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.field-label {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-tertiary, #94a3b8);
	}

	.text-input,
	.paste-area {
		padding: 6px 8px;
		font-size: 12px;
		font-family: var(--font-mono, monospace);
		color: var(--color-text-primary, #1e293b);
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 5px;
		outline: none;
	}

	.text-input:focus,
	.paste-area:focus {
		border-color: var(--color-accent, #6366f1);
	}

	:global(.dark) .text-input,
	:global(.dark) .paste-area {
		background: #1e293b;
		border-color: #334155;
		color: #e2e8f0;
	}

	.paste-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.paste-area {
		resize: vertical;
		line-height: 1.4;
	}

	.error {
		margin: 0;
		font-size: 12px;
		color: #ef4444;
	}

	.loaded {
		display: flex;
		flex-direction: column;
		gap: 10px;
		border-top: 1px solid var(--color-border, #e2e8f0);
		padding-top: 12px;
	}

	:global(.dark) .loaded {
		border-color: #1e293b;
	}

	.catalog-head {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.catalog-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--color-text-primary, #1e293b);
	}

	:global(.dark) .catalog-title {
		color: #e2e8f0;
	}

	.catalog-coord {
		font-size: 11px;
		font-family: var(--font-mono, monospace);
		color: var(--color-text-tertiary, #94a3b8);
	}

	.unverified {
		margin: 0;
		font-size: 11px;
		color: #b45309;
	}

	:global(.dark) .unverified {
		color: #fbbf24;
	}

	.footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 16px;
		border-top: 1px solid var(--color-border, #e2e8f0);
	}

	:global(.dark) .footer {
		border-color: #1e293b;
	}

	.primary-btn {
		padding: 6px 14px;
		font-size: 12px;
		font-weight: 600;
		color: #fff;
		background: var(--color-accent, #6366f1);
		border: none;
		border-radius: 6px;
		cursor: pointer;
	}

	.primary-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.secondary-btn {
		padding: 6px 14px;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary, #475569);
		background: none;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		cursor: pointer;
	}

	:global(.dark) .secondary-btn {
		color: #cbd5e1;
		border-color: #334155;
	}
</style>
