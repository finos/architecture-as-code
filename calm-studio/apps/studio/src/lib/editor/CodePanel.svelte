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

	let editorView = $state<EditorView | undefined>(undefined);
	let localValue = $state(value);
	let isFocused = $state(false);
	let lastSyncedExternal = $state(value);
	let lastSelectionNodeId = $state<string | null | undefined>(undefined);
	let lastSelectionEdgeId = $state<string | null | undefined>(undefined);

	const extensions = $derived<Extension[]>([
		linter(jsonParseLinter()),
		lintGutter(),
		EditorView.lineWrapping,
	]);

	// Sync external model → editor only when not actively typing.
	$effect(() => {
		const external = value;
		if (external === lastSyncedExternal) return;
		lastSyncedExternal = external;
		if (!isFocused) {
			localValue = external;
		}
	});

	function scrollToSelection(
		id: string | null | undefined,
		finder: (json: string, id: string) => { start: number; end: number } | null
	) {
		if (!id || !editorView) return;
		const offsets = finder(localValue, id);
		if (!offsets) return;
		editorView.dispatch({
			selection: { anchor: offsets.start, head: offsets.end },
			scrollIntoView: true,
		});
	}

	$effect(() => {
		const nodeId = selectedNodeId;
		if (nodeId === lastSelectionNodeId) return;
		lastSelectionNodeId = nodeId;
		scrollToSelection(nodeId, findNodeOffset);
	});

	$effect(() => {
		const edgeId = selectedEdgeId;
		if (edgeId === lastSelectionEdgeId) return;
		lastSelectionEdgeId = edgeId;
		scrollToSelection(edgeId, findRelationshipOffset);
	});

	function handleChange(newValue: string) {
		localValue = newValue;
		onchange?.(newValue);
	}

	function handleReady(view: EditorView) {
		editorView = view;
	}

	function handleFocus() {
		isFocused = true;
	}

	function handleBlur() {
		isFocused = false;
		if (localValue !== value) {
			lastSyncedExternal = value;
		}
	}
</script>

<div class="code-panel" class:dark={isDark()}>
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

	<div class="editor-wrap" onfocusin={handleFocus} onfocusout={handleBlur}>
		<CodeMirror
			value={localValue}
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
		background: #22c55e;
		flex-shrink: 0;
	}

	.status.error {
		color: #ef4444;
	}

	.status.error .status-dot {
		background: #ef4444;
	}

	.editor-wrap {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.editor-wrap :global(.codemirror-wrapper) {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.editor-wrap :global(.cm-editor) {
		height: 100%;
	}

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
