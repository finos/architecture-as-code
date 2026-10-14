<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import type { ContainmentVariant } from './containmentLastUsed';

	interface Props {
		childLabel: string;
		parentLabel: string;
		onconfirm: (variant: ContainmentVariant) => void;
		oncancel: () => void;
	}

	let { childLabel, parentLabel, onconfirm, oncancel }: Props = $props();

	let variant = $state<ContainmentVariant>('composed-of');

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			oncancel();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			onconfirm(variant);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="backdrop" role="presentation">
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="contain-title">
		<h2 id="contain-title" class="title">Containment type</h2>
		<p class="hint">Nest “{childLabel}” in “{parentLabel}”?</p>
		<label class="radio">
			<input type="radio" bind:group={variant} value="composed-of" />
			Composed of
		</label>
		<label class="radio">
			<input type="radio" bind:group={variant} value="deployed-in" />
			Deployed in
		</label>
		<div class="actions">
			<button type="button" class="btn" onclick={oncancel}>Cancel</button>
			<button type="button" class="btn primary" onclick={() => onconfirm(variant)}>OK</button>
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
		width: min(360px, calc(100vw - 32px));
		padding: 18px 20px;
		border-radius: 10px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18);
	}
	.title {
		margin: 0 0 8px;
		font-size: 15px;
		font-weight: 600;
	}
	.hint {
		margin: 0 0 12px;
		font-size: 13px;
		color: #64748b;
	}
	.radio {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		margin: 6px 0;
		cursor: pointer;
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
		font-size: 12px;
		cursor: pointer;
	}
	.btn.primary {
		background: #2563eb;
		border-color: #2563eb;
		color: #fff;
	}
</style>
