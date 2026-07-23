<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	const STORAGE_KEY = 'calm-studio.duplicateRelationships';

	export interface DuplicateNodeResult {
		name: string;
		duplicateRelationships: boolean;
	}

	interface Props {
		defaultName: string;
		onconfirm: (result: DuplicateNodeResult) => void;
		oncancel: () => void;
	}

	let { defaultName, onconfirm, oncancel }: Props = $props();

	function loadCheckbox(): boolean {
		if (typeof sessionStorage === 'undefined') return false;
		return sessionStorage.getItem(STORAGE_KEY) === 'true';
	}

	let name = $state(defaultName);
	let duplicateRelationships = $state(loadCheckbox());
	let nameInput: HTMLInputElement | undefined = $state();

	$effect(() => {
		nameInput?.focus();
		nameInput?.select();
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
		const trimmed = name.trim();
		if (!trimmed) return;
		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem(STORAGE_KEY, String(duplicateRelationships));
		}
		onconfirm({ name: trimmed, duplicateRelationships });
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" role="presentation" onclick={handleBackdrop}>
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dup-title">
		<h2 id="dup-title" class="title">Duplicate node</h2>
		<label class="field">
			<span class="label">Name</span>
			<input
				bind:this={nameInput}
				bind:value={name}
				type="text"
				class="input"
				required
			/>
		</label>
		<label class="checkbox-row">
			<input type="checkbox" bind:checked={duplicateRelationships} />
			<span>Duplicate relationships</span>
		</label>
		<div class="actions">
			<button type="button" class="btn" onclick={oncancel}>Cancel</button>
			<button type="button" class="btn primary" onclick={submit} disabled={!name.trim()}>OK</button>
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
		width: min(420px, calc(100vw - 32px));
		padding: 20px 22px;
		border-radius: 10px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18);
	}

	.title {
		margin: 0 0 14px;
		font-size: 16px;
		font-weight: 600;
		color: var(--color-text-primary, #0f172a);
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

	.checkbox-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 18px;
		font-size: 13px;
		color: var(--color-text-primary, #0f172a);
		cursor: pointer;
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

	.btn:hover:not(:disabled) {
		filter: brightness(0.97);
	}
</style>
