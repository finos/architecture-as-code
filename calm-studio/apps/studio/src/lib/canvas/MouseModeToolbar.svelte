<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import type { MouseCanvasMode } from './mousePanSelect';

	interface Props {
		mode: MouseCanvasMode;
		locked?: boolean;
		onchange: (mode: MouseCanvasMode) => void;
	}

	let { mode, locked = false, onchange }: Props = $props();
</script>

<div class="mouse-mode" role="toolbar" aria-label="Canvas mouse mode">
	<button
		type="button"
		class="mode-btn"
		aria-pressed={mode === 'select'}
		aria-label="Select"
		disabled={locked}
		title="Select (marquee and move nodes)"
		onclick={() => onchange('select')}
	>
		Select
	</button>
	<button
		type="button"
		class="mode-btn"
		aria-pressed={mode === 'pan'}
		aria-label="Pan"
		disabled={locked}
		title="Pan the canvas"
		onclick={() => onchange('pan')}
	>
		Pan
	</button>
</div>

<style>
	.mouse-mode {
		position: absolute;
		top: 8px;
		left: 8px;
		z-index: 21;
		display: flex;
		gap: 2px;
		padding: 3px;
		border-radius: 8px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
	}
	.mode-btn {
		height: 26px;
		padding: 0 10px;
		border: none;
		border-radius: 6px;
		background: transparent;
		font-size: 12px;
		cursor: pointer;
		color: var(--color-text-secondary, #64748b);
	}
	.mode-btn[aria-pressed='true'] {
		background: var(--color-surface-tertiary, #e2e8f0);
		color: var(--color-text-primary, #0f172a);
		font-weight: 600;
	}
	.mode-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
