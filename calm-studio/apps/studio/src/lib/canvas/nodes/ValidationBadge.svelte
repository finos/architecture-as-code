<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  ValidationBadge.svelte — Reusable validation issue badge overlay.

  Renders as an absolute-positioned circle in the top-right corner of the node.
  Red for errors, amber for warnings. Clicking calls setScrollToElementId to
  coordinate panel scroll in Plan 02.

  The parent .node div must have position: relative for the badge to anchor.
-->
<script lang="ts">
	import { setScrollToElementId } from '$lib/stores/validation.svelte';

	interface Props {
		errorCount: number;
		warnCount: number;
		nodeId: string;
	}

	let { errorCount, warnCount, nodeId }: Props = $props();

	const isError = $derived(errorCount > 0);
	const hasIssues = $derived(errorCount > 0 || warnCount > 0);
	const count = $derived(errorCount > 0 ? errorCount : warnCount);

	const tooltipText = $derived(() => {
		const parts: string[] = [];
		if (errorCount > 0) parts.push(`${errorCount} error${errorCount !== 1 ? 's' : ''}`);
		if (warnCount > 0) parts.push(`${warnCount} warning${warnCount !== 1 ? 's' : ''}`);
		return parts.join(', ');
	});

	function handleClick(e: MouseEvent) {
		e.stopPropagation();
		setScrollToElementId(nodeId);
	}
</script>

{#if hasIssues}
	<button
		class="badge"
		class:error={isError}
		class:warning={!isError}
		title={tooltipText()}
		aria-label="{tooltipText()} on this node"
		onclick={handleClick}
	>
		{count > 99 ? '99+' : count}
	</button>
{/if}

<style>
	.badge {
		position: absolute;
		top: -8px;
		right: -8px;
		z-index: 10;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--node-font, system-ui, sans-serif);
		font-size: 11px;
		font-weight: bold;
		color: white;
		cursor: pointer;
		padding: 0;
		line-height: 1;
		transition: transform 0.1s ease;
	}

	.badge:hover {
		transform: scale(1.15);
	}

	.badge.error {
		background-color: #dc2626;
	}

	.badge.warning {
		background-color: #d97706;
	}
</style>
