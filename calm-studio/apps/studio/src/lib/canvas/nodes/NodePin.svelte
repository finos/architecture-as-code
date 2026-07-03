<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  NodePin.svelte — Pin toggle button overlay for CALM nodes.

  Usage: drop inside any node component wrapper div.
  Receives the node id and current pinned state via props.
  Dispatches a custom DOM event 'node:toggle-pin' with { id } for the canvas to handle.
-->
<script lang="ts">
	let { id, pinned }: { id: string; pinned?: boolean } = $props();

	function togglePin(event: MouseEvent) {
		event.stopPropagation();
		// Dispatch a custom DOM event bubbling up to the canvas
		const el = event.currentTarget as HTMLElement;
		el.dispatchEvent(
			new CustomEvent('node:toggle-pin', {
				bubbles: true,
				detail: { id },
			})
		);
	}
</script>

<!-- Pin button — visible on parent hover via CSS -->
<button
	type="button"
	class="pin-btn"
	class:pinned
	onclick={togglePin}
	aria-label={pinned ? 'Unpin node' : 'Pin node (stays fixed during auto-layout)'}
	title={pinned ? 'Unpin node' : 'Pin node'}
>
	<svg width="10" height="10" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2.5" aria-hidden="true">
		<!-- Pushpin icon -->
		<path d="M12 2L8 8H4l4 6v4l4-2 4 2v-4l4-6h-4L12 2z" stroke-linecap="round" stroke-linejoin="round" />
		<line x1="12" y1="18" x2="12" y2="22" stroke-linecap="round" />
	</svg>
</button>

<style>
	.pin-btn {
		position: absolute;
		top: 3px;
		right: 3px;
		width: 18px;
		height: 18px;
		border: none;
		background: transparent;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		color: var(--color-text-tertiary, #94a3b8);
		transition: opacity 0.15s, color 0.15s, background 0.15s;
		padding: 0;
		z-index: 10;
	}

	/* Show on parent hover */
	:global(.node:hover) .pin-btn,
	:global(.node.selected) .pin-btn,
	.pin-btn.pinned {
		opacity: 1;
	}

	.pin-btn:hover {
		background: var(--color-surface-tertiary, #f1f5f9);
		color: var(--color-text-primary, #1e293b);
	}

	.pin-btn.pinned {
		color: var(--color-accent, #3b82f6);
	}

	:global(.dark) .pin-btn {
		color: #64748b;
	}

	:global(.dark) .pin-btn:hover {
		background: #1e293b;
		color: #e2e8f0;
	}

	:global(.dark) .pin-btn.pinned {
		color: #60a5fa;
	}
</style>
