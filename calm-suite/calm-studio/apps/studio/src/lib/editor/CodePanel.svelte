<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { EditorView } from '@codemirror/view';
	import { json, jsonParseLinter } from '@codemirror/lang-json';
	import { linter, lintGutter } from '@codemirror/lint';
	import { oneDark } from '@codemirror/theme-one-dark';
	import type { Extension } from '@codemirror/state';
	import CodeMirror from 'svelte-codemirror-editor';
	import { isDark } from '$lib/stores/theme.svelte';
	import { findNodeOffset, findRelationshipOffset } from './useJsonSync';

	interface Props {
		/** The CALM JSON string to display and edit. */
		value: string;
		/** Called on every edit with the new value. */
		onchange?: (value: string) => void;
		/** Error message to show in status bar; null/undefined when valid. */
		parseError?: string | null;
		/** When set, scrolls the editor to the corresponding node JSON block. */
		selectedNodeId?: string | null;
		/** When set, scrolls the editor to the corresponding edge JSON block. */
		selectedEdgeId?: string | null;
	}

	let { value, onchange, parseError, selectedNodeId, selectedEdgeId }: Props = $props();

	// Hold the CodeMirror EditorView reference to dispatch scroll/selection commands.
	let editorView = $state<EditorView | undefined>(undefined);

	// Build extensions list reactively — includes JSON linting and optional dark theme.
	const extensions = $derived<Extension[]>([
		linter(jsonParseLinter()),
		lintGutter(),
		EditorView.lineWrapping,
	]);

	// When selectedNodeId changes, scroll the editor to that node's JSON block.
	$effect(() => {
		const nodeId = selectedNodeId;
		if (!nodeId || !editorView) return;

		const offsets = findNodeOffset(value, nodeId);
		if (!offsets) return;

		editorView.dispatch({
			selection: { anchor: offsets.start, head: offsets.end },
			scrollIntoView: true,
		});
	});

	// When selectedEdgeId changes, scroll the editor to that edge's JSON block.
	$effect(() => {
		const edgeId = selectedEdgeId;
		if (!edgeId || !editorView) return;

		const offsets = findRelationshipOffset(value, edgeId);
		if (!offsets) return;

		editorView.dispatch({
			selection: { anchor: offsets.start, head: offsets.end },
			scrollIntoView: true,
		});
	});

	function handleChange(newValue: string) {
		onchange?.(newValue);
	}

	function handleReady(view: EditorView) {
		editorView = view;
	}
</script>

<div class="code-panel" class:dark={isDark()}>
	<!-- Tab bar -->
	<div class="tab-bar">
		<div class="tabs">
			<button class="tab active" type="button">CALM JSON</button>
			<button
				class="tab disabled"
				type="button"
				disabled
				title="Coming in Phase 5"
				aria-disabled="true"
			>
				calmscript
			</button>
		</div>
		<span class="status" class:error={!!parseError} aria-live="polite">
			<span class="status-dot"></span>
			{parseError ? 'Invalid JSON' : 'Valid'}
		</span>
	</div>

	<!-- CodeMirror editor -->
	<div class="editor-wrap">
		<CodeMirror
			{value}
			lang={json()}
			theme={isDark() ? oneDark : undefined}
			{extensions}
			lineNumbers
			lineWrapping
			nodebounce
			onchange={handleChange}
			onready={handleReady}
			styles={{
				'&': { height: '100%', fontSize: '12.5px' },
				'.cm-scroller': { overflow: 'auto' },
			}}
		/>
	</div>
</div>

<style>
	.code-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		overflow: hidden;
	}

	/* Tab bar */
	.tab-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 30px;
		min-height: 30px;
		padding: 0 8px;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.tabs {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		height: 22px;
		padding: 0 10px;
		border: none;
		border-radius: 4px;
		background: transparent;
		font-size: 11.5px;
		font-family: inherit;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: background 0.1s ease, color 0.1s ease;
	}

	.tab.active {
		background: var(--color-surface-tertiary, rgba(0, 0, 0, 0.06));
		color: var(--color-text-primary);
		font-weight: 500;
	}

	.tab.disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.tab:not(.disabled):hover {
		background: var(--color-surface-tertiary, rgba(0, 0, 0, 0.06));
	}

	/* Status indicator */
	.status {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		color: var(--color-text-secondary);
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #22c55e; /* green */
		flex-shrink: 0;
	}

	.status.error {
		color: #ef4444;
	}

	.status.error .status-dot {
		background: #ef4444;
	}

	/* Editor fill */
	.editor-wrap {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	/* Reach into CodeMirror host to fill height */
	.editor-wrap :global(.codemirror-wrapper) {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.editor-wrap :global(.cm-editor) {
		height: 100%;
	}

	/* Dark mode overrides */
	:global(.dark) .code-panel {
		background: #0d1117;
		border-top-color: #334155;
	}

	:global(.dark) .tab-bar {
		background: #0d1117;
		border-bottom-color: #334155;
	}

	:global(.dark) .tab.active {
		background: rgba(255, 255, 255, 0.08);
		color: #e2e8f0;
	}

	:global(.dark) .tab {
		color: #94a3b8;
	}

	:global(.dark) .status {
		color: #94a3b8;
	}
</style>
