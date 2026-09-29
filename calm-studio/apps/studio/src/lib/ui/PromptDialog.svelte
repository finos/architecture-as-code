<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { onMount } from 'svelte';

	import type { ExplorerTreeEntry } from '$lib/explorer/types';
	import MoveFolderTreeView from '$lib/explorer/MoveFolderTreeView.svelte';

	interface Props {
		title: string;
		label: string;
		value: string;
		hint?: string;
		error?: string;
		placeholder?: string;
		extraLabel?: string;
		extraValue?: string;
		/** When set, shows a folder treeview for the extra (destination) field. */
		folderTree?: ExplorerTreeEntry[] | null;
		confirmLabel?: string;
		onconfirm: (value: string, extra?: string) => void;
		oncancel: () => void;
	}

	let {
		title,
		label,
		value,
		hint = '',
		error = '',
		placeholder = '',
		extraLabel = '',
		extraValue = '',
		folderTree = null,
		confirmLabel = 'OK',
		onconfirm,
		oncancel,
	}: Props = $props();

	let draft = $state(value);
	let extraDraft = $state(extraValue);
	let inputEl: HTMLInputElement | undefined;

	onMount(() => {
		inputEl?.focus();
		if (value) inputEl?.select();
	});

	function submit() {
		onconfirm(draft.trim(), extraLabel ? extraDraft.trim() : undefined);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && oncancel()}>
	<div class="dialog" class:wide={folderTree != null} role="dialog" aria-modal="true" aria-labelledby="prompt-title">
		<h2 id="prompt-title" class="title">{title}</h2>
		{#if hint}
			<p class="hint">{hint}</p>
		{/if}
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
		<label class="field-label" for="prompt-value">{label}</label>
		<input
			id="prompt-value"
			class="input"
			bind:this={inputEl}
			bind:value={draft}
			{placeholder}
			onkeydown={(e) => e.key === 'Enter' && submit()}
		/>
		{#if extraLabel}
			<label class="field-label" for="prompt-extra">{extraLabel}</label>
			<input id="prompt-extra" class="input" bind:value={extraDraft} />
		{/if}
		{#if folderTree != null}
			<p class="field-label" id="prompt-folders-label">Project folders</p>
			<MoveFolderTreeView
				entries={folderTree}
				selectedFieldValue={extraDraft}
				onselect={(value) => (extraDraft = value)}
			/>
		{/if}
		<div class="actions">
			<button type="button" class="btn" onclick={oncancel}>Cancel</button>
			<button type="button" class="btn primary" onclick={submit} disabled={!draft.trim()}>{confirmLabel}</button>
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
		width: min(420px, calc(100vw - 32px));
		padding: 18px 20px;
		border-radius: 10px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
	}
	.dialog.wide {
		width: min(480px, calc(100vw - 32px));
	}
	.title {
		margin: 0 0 8px;
		font-size: 15px;
	}
	.hint {
		margin: 0 0 10px;
		font-size: 12px;
		color: #64748b;
	}
	.error {
		margin: 0 0 10px;
		font-size: 12px;
		color: #b91c1c;
	}
	.field-label {
		display: block;
		margin: 8px 0 4px;
		font-size: 12px;
		font-weight: 600;
	}
	.input {
		width: 100%;
		padding: 7px 10px;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		font-size: 13px;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 14px;
	}
	.btn {
		padding: 7px 14px;
		border-radius: 6px;
		border: 1px solid #cbd5e1;
		background: #fff;
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
