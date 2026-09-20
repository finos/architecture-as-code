<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	interface Props {
		x: number;
		y: number;
		showMove: boolean;
		onnewfolder: () => void;
		onnewfile: () => void;
		onmove: () => void;
	}

	let { x, y, showMove, onnewfolder, onnewfile, onmove }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
	class="ctx-menu"
	style:left={`${x}px`}
	style:top={`${y}px`}
	role="menu"
	tabindex="-1"
	onclick={(e) => e.stopPropagation()}
	oncontextmenu={(e) => e.preventDefault()}
>
	<button type="button" class="ctx-item" role="menuitem" onclick={onnewfolder}>New folder…</button>
	<button type="button" class="ctx-item" role="menuitem" onclick={onnewfile}>New file…</button>
	{#if showMove}
		<button type="button" class="ctx-item" role="menuitem" onclick={onmove}>Move…</button>
	{/if}
</div>

<style>
	.ctx-menu {
		position: fixed;
		z-index: 11000;
		min-width: 180px;
		padding: 4px;
		border-radius: 8px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
	}
	.ctx-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 7px 10px;
		border: none;
		border-radius: 6px;
		background: transparent;
		font-size: 12px;
		cursor: pointer;
		color: var(--color-text-primary, #0f172a);
	}
	.ctx-item:hover {
		background: var(--color-surface-tertiary, #f1f5f9);
	}
</style>
