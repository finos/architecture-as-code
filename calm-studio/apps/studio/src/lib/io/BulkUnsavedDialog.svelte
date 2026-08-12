<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	interface Props {
		filenames: string[];
		onsaveall: () => void;
		ondiscard: () => void;
		oncancel: () => void;
	}

	let { filenames, onsaveall, ondiscard, oncancel }: Props = $props();

	function handleBackdrop(event: MouseEvent) {
		if (event.target === event.currentTarget) oncancel();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') oncancel();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" role="presentation" onclick={handleBackdrop}>
	<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="bulk-unsaved-title">
		<h2 id="bulk-unsaved-title" class="title">Unsaved changes</h2>
		<p class="message">Do you want to save changes to the following diagrams before closing?</p>
		<ul class="files">
			{#each filenames as name}
				<li>{name}</li>
			{/each}
		</ul>
		<div class="actions">
			<button type="button" class="btn primary" onclick={onsaveall}>Save all</button>
			<button type="button" class="btn" onclick={ondiscard}>Don't save</button>
			<button type="button" class="btn" onclick={oncancel}>Cancel</button>
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
		width: min(440px, calc(100vw - 32px));
		padding: 20px 22px;
		border-radius: 10px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18);
	}
	.title {
		margin: 0 0 10px;
		font-size: 16px;
		font-weight: 600;
	}
	.message {
		margin: 0 0 10px;
		font-size: 13px;
		color: var(--color-text-secondary, #475569);
	}
	.files {
		margin: 0 0 16px;
		padding-left: 18px;
		font-size: 13px;
		max-height: 160px;
		overflow: auto;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		flex-wrap: wrap;
	}
	.btn {
		padding: 7px 14px;
		border-radius: 6px;
		border: 1px solid var(--color-border, #cbd5e1);
		background: #fff;
		font-size: 12px;
		cursor: pointer;
	}
	.btn.primary {
		background: var(--color-accent, #2563eb);
		border-color: var(--color-accent, #2563eb);
		color: #fff;
	}
</style>
