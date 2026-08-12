<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	let {
		title = 'Reference to another architecture diagram',
		placement = 'overlay',
		ondblclick,
	}: {
		title?: string;
		placement?: 'overlay' | 'inline';
		ondblclick?: (e: MouseEvent) => void;
	} = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="reference-glasses"
	class:inline={placement === 'inline'}
	{title}
	ondblclick={(e) => {
		e.stopPropagation();
		ondblclick?.(e);
	}}
	role="button"
	tabindex="0"
	aria-label={title}
>
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
		<circle cx="6" cy="12" r="4" />
		<circle cx="18" cy="12" r="4" />
		<path d="M10 12h4" />
	</svg>
</div>

<style>
	.reference-glasses {
		position: absolute;
		top: 4px;
		right: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 4px;
		background: var(--surface-elevated, #fff);
		border: 1px solid var(--border-subtle, #cbd5e1);
		color: var(--accent, #2563eb);
		cursor: pointer;
		z-index: 2;
	}
	.reference-glasses:hover {
		background: var(--accent-muted, #eff6ff);
	}
	.reference-glasses.inline {
		position: static;
		flex-shrink: 0;
		margin-left: 4px;
	}
</style>
