<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { EditorView } from '@codemirror/view';
	import { EditorState, type Extension } from '@codemirror/state';
	import { json, jsonParseLinter } from '@codemirror/lang-json';
	import { linter, lintGutter } from '@codemirror/lint';
	import { oneDark } from '@codemirror/theme-one-dark';
	import CodeMirror from 'svelte-codemirror-editor';
	import { isDark } from '$lib/stores/theme.svelte';
	import { findNodeOffset, findRelationshipOffset } from './useJsonSync';

	interface Props {
		/** The CALM JSON string to display and edit. */
		value: string;
		/** Read-only Mermaid flowchart source for the Mermaid tab (R85). */
		mermaid?: string;
		/** Called on every edit with the new value. */
		onchange?: (value: string) => void;
		/** Error message to show in status bar; null/undefined when valid. */
		parseError?: string | null;
		/** When set, scrolls the editor to the corresponding node JSON block. */
		selectedNodeId?: string | null;
		/** When set, scrolls the editor to the corresponding edge JSON block. */
		selectedEdgeId?: string | null;
		readonly?: boolean;
	}

	let {
		value,
		mermaid = '',
		onchange,
		parseError,
		selectedNodeId,
		selectedEdgeId,
		readonly = false,
	}: Props = $props();

	let editorView = $state<EditorView | undefined>(undefined);
	let localValue = $state(value);
	let isFocused = $state(false);
	let lastSyncedExternal = $state(value);
	let lastSelectionNodeId = $state<string | null | undefined>(undefined);
	let lastSelectionEdgeId = $state<string | null | undefined>(undefined);
	let activeTab = $state<'json' | 'mermaid'>('json');

	const extensions = $derived<Extension[]>([
		linter(jsonParseLinter()),
		lintGutter(),
		EditorView.lineWrapping,
		EditorView.editable.of(!readonly),
		EditorState.readOnly.of(readonly),
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
		if (!id || !editorView || activeTab !== 'json') return;
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
		if (readonly) return;
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
		<div class="tabs" role="tablist" aria-label="Code panel views">
			<button
				class="tab"
				class:active={activeTab === 'json'}
				type="button"
				role="tab"
				aria-selected={activeTab === 'json'}
				onclick={() => (activeTab = 'json')}
			>
				CALM JSON
			</button>
			<button
				class="tab"
				class:active={activeTab === 'mermaid'}
				type="button"
				role="tab"
				aria-selected={activeTab === 'mermaid'}
				onclick={() => (activeTab = 'mermaid')}
			>
				Mermaid
			</button>
		</div>
		{#if activeTab === 'json'}
			<span class="status" class:error={!!parseError} aria-live="polite">
				<span class="status-dot"></span>
				{parseError ? 'Invalid JSON' : 'Valid'}
			</span>
		{:else}
			<span class="status" aria-live="polite">
				<span class="status-dot"></span>
				Read-only
			</span>
		{/if}
	</div>

	{#if activeTab === 'json'}
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
	{:else}
		<pre class="mermaid-view" aria-label="Mermaid flowchart (read-only)">{mermaid}</pre>
	{/if}
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

	.tab:hover {
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

	.mermaid-view {
		flex: 1;
		min-height: 0;
		margin: 0;
		padding: 10px 12px;
		overflow: auto;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 12.5px;
		line-height: 1.45;
		white-space: pre;
		color: var(--color-text-primary, var(--color-text));
		background: var(--color-surface);
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

	:global(.dark) .mermaid-view {
		background: #0d1117;
		color: #e2e8f0;
	}
</style>
