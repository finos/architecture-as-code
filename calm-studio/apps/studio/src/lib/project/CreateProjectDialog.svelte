<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	interface Props {
		defaultName?: string;
		onconfirm: (result: { name: string; fileName: string }) => void;
		oncancel: () => void;
		onskip?: () => void;
	}

	let { defaultName = 'project', onconfirm, oncancel, onskip }: Props = $props();

	let name = $state(defaultName);
	let fileName = $state(`${defaultName}.calmrj`);
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
		let fn = fileName.trim() || `${trimmed}.calmrj`;
		if (!fn.toLowerCase().endsWith('.calmrj')) fn = `${fn}.calmrj`;
		onconfirm({ name: trimmed, fileName: fn });
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" role="presentation" onclick={handleBackdrop}>
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="create-prj-title">
		<h2 id="create-prj-title" class="title">Create project</h2>
		<p class="hint">No <code>.calmrj</code> file found. Create one to store validation rules and naming conventions.</p>
		<label class="field">
			<span class="label">Project name</span>
			<input bind:this={nameInput} bind:value={name} type="text" class="input" required />
		</label>
		<label class="field">
			<span class="label">File name</span>
			<input bind:value={fileName} type="text" class="input" />
		</label>
		<div class="actions">
			{#if onskip}
				<button type="button" class="btn" onclick={onskip}>Skip</button>
			{/if}
			<button type="button" class="btn" onclick={oncancel}>Cancel</button>
			<button type="button" class="btn primary" onclick={submit} disabled={!name.trim()}>Create</button>
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
		margin: 0 0 8px;
		font-size: 16px;
		font-weight: 600;
		color: var(--color-text-primary, #0f172a);
	}
	.hint {
		margin: 0 0 14px;
		font-size: 12px;
		color: var(--color-text-secondary, #475569);
		line-height: 1.4;
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
		margin-top: 6px;
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
