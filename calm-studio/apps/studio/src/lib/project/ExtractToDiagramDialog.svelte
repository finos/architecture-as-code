<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	export interface ExtractDialogResult {
		folder: string;
		fileName: string;
	}

	interface Props {
		defaultFolder: string;
		defaultFileName: string;
		warning?: string | null;
		onconfirm: (result: ExtractDialogResult) => void;
		oncancel: () => void;
	}

	let { defaultFolder, defaultFileName, warning = null, onconfirm, oncancel }: Props = $props();

	let folder = $state(defaultFolder);
	let fileName = $state(defaultFileName);
	let folderInput: HTMLInputElement | undefined = $state();

	$effect(() => {
		folderInput?.focus();
		folderInput?.select();
	});

	function handleBackdrop(event: MouseEvent) {
		if (event.target === event.currentTarget) oncancel();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			oncancel();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			submit();
		}
	}

	function submit() {
		const f = fileName.trim();
		if (!f) return;
		onconfirm({ folder: folder.trim().replace(/\/+$/, ''), fileName: f });
	}

	const canSubmit = $derived(fileName.trim().length > 0);
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" role="presentation" onclick={handleBackdrop}>
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="extract-title">
		<h2 id="extract-title" class="title">Extract to diagram</h2>
		{#if warning}
			<p class="warn" role="status">{warning}</p>
		{/if}
		<label class="field">
			<span class="label">Folder</span>
			<input bind:this={folderInput} bind:value={folder} type="text" class="input" placeholder="application-components/bem" />
		</label>
		<label class="field">
			<span class="label">File</span>
			<input bind:value={fileName} type="text" class="input" placeholder="bem.appcomp.json" required />
		</label>
		<div class="actions">
			<button type="button" class="btn" onclick={oncancel}>Cancel</button>
			<button type="button" class="btn primary" onclick={submit} disabled={!canSubmit}>Extract</button>
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
		backdrop-filter: blur(2px);
	}
	.dialog {
		width: min(460px, calc(100vw - 32px));
		padding: 20px 22px;
		border-radius: 10px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18);
	}
	.title {
		margin: 0 0 12px;
		font-size: 16px;
		font-weight: 600;
		color: var(--color-text-primary, #0f172a);
	}
	.warn {
		margin: 0 0 12px;
		padding: 8px 10px;
		border-radius: 6px;
		background: #fff7ed;
		border: 1px solid #fed7aa;
		font-size: 12px;
		color: #9a3412;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
	}
	.label {
		font-size: 12px;
		color: var(--color-text-secondary, #475569);
	}
	.input {
		padding: 8px 10px;
		border: 1px solid var(--color-border, #cbd5e1);
		border-radius: 6px;
		font-size: 13px;
		background: var(--color-surface, #fff);
		color: var(--color-text-primary, #0f172a);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	.btn {
		padding: 7px 14px;
		border-radius: 6px;
		border: 1px solid var(--color-border, #cbd5e1);
		background: var(--color-surface, #fff);
		font-size: 12px;
		cursor: pointer;
	}
	.btn.primary {
		background: var(--color-accent, #2563eb);
		border-color: var(--color-accent, #2563eb);
		color: #fff;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
