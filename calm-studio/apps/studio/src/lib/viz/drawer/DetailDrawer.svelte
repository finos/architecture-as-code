<!--
  SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
	import type { CalmNode, CalmArchitecture } from '@calmstudio/calm-core';
	import ControlsSection from './sections/ControlsSection.svelte';
	import ThreatsSection from './sections/ThreatsSection.svelte';
	import DecoratorsSection from './sections/DecoratorsSection.svelte';
	import ComposedOfSection from './sections/ComposedOfSection.svelte';

	let {
		arch,
		selectedNode,
		onclose
	}: { arch: CalmArchitecture; selectedNode: CalmNode | null; onclose: () => void } = $props();
</script>

{#if selectedNode}
	<aside class="detail-drawer" aria-label="Node details">
		<header class="dr-head">
			<div>
				<h2 class="ttl">{selectedNode.name ?? selectedNode['unique-id']}</h2>
				<p class="typ">{selectedNode['node-type']}</p>
			</div>
			<button class="close" onclick={onclose} aria-label="Close detail drawer">×</button>
		</header>

		{#if selectedNode.description}
			<section class="dr-sec">
				<h3 class="dr-sec-h">Description</h3>
				<p class="dr-desc">{selectedNode.description}</p>
			</section>
		{/if}

		<ControlsSection node={selectedNode} />
		<ThreatsSection node={selectedNode} />
		<DecoratorsSection node={selectedNode} />
		<ComposedOfSection node={selectedNode} {arch} />
	</aside>
{/if}

<style>
	.detail-drawer {
		position: absolute;
		top: 12px;
		right: 12px;
		bottom: 12px;
		width: 320px;
		background: rgba(15, 17, 22, 0.94);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border: 1px solid rgb(31 36 46 / 1);
		border-radius: 10px;
		padding: 14px;
		z-index: 11;
		overflow-y: auto;
		color: rgb(209 213 219 / 1);
	}
	.dr-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding-bottom: 10px;
		border-bottom: 1px solid rgb(31 36 46 / 1);
		margin-bottom: 12px;
	}
	.ttl {
		font: 600 13px/1.2 'Inter', sans-serif;
		color: rgb(243 244 246 / 1);
		margin: 0;
	}
	.typ {
		font: 500 9px/1 'Geist Mono', ui-monospace, monospace;
		color: rgb(107 114 128 / 1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin: 3px 0 0;
	}
	.close {
		background: transparent;
		border: 0;
		color: rgb(156 163 175 / 1);
		font-size: 20px;
		line-height: 1;
		cursor: pointer;
		padding: 0 4px;
	}
	.close:hover {
		color: rgb(243 244 246 / 1);
	}
	.dr-sec {
		margin-bottom: 12px;
	}
	.dr-sec-h {
		font: 600 9px/1 'Geist Mono', monospace;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: rgb(107 114 128 / 1);
		margin: 0 0 6px;
	}
	.dr-desc {
		font: 400 11px/1.4 'Inter', sans-serif;
		color: rgb(156 163 175 / 1);
		margin: 0;
	}
</style>
