<!--
  SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
	import type { OverlayState } from './overlayStore.svelte';

	let {
		overlay,
		threatCount = 0
	}: { overlay: OverlayState; threatCount?: number } = $props();

	const disabled = $derived(threatCount === 0);
	const isActive = $derived(overlay.mode === 'threat');
</script>

<button
	class="overlay-toggle"
	class:active={isActive}
	{disabled}
	aria-pressed={isActive}
	title={disabled ? 'No threats to overlay' : 'Toggle threat overlay'}
	onclick={() => overlay.toggle()}
>
	<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
	</svg>
	<span class="lbl">{isActive ? `Threats (${threatCount})` : 'Default'}</span>
</button>

<style>
	.overlay-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(20, 23, 30, 0.85);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid rgb(31 36 46 / 1);
		color: rgb(209 213 219 / 1);
		font: 500 11px/1 'Inter', -apple-system, sans-serif;
		padding: 6px 10px;
		border-radius: 6px;
		cursor: pointer;
	}
	.overlay-toggle.active {
		background: rgba(244, 63, 94, 0.12);
		border-color: rgba(244, 63, 94, 0.35);
		color: rgb(253 164 175 / 1);
	}
	.overlay-toggle:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.overlay-toggle:not(:disabled):hover {
		background: rgba(28, 33, 43, 0.9);
	}
</style>
