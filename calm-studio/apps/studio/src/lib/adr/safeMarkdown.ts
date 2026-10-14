// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/** Escape text, then apply a small CommonMark subset. Raw HTML is never executed. */

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function inline(value: string): string {
	return value
		.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

export function renderSafeMarkdown(source: string): string {
	const escaped = escapeHtml(source.replace(/\r\n/g, '\n'));
	const withCode = escaped.replace(/```([\s\S]*?)```/g, (_match, code: string) => {
		return `<pre><code>${code.replace(/^\n|\n$/g, '')}</code></pre>`;
	});
	const blocks = withCode.split(/\n{2,}/);
	return blocks
		.map((block) => {
			if (block.startsWith('<pre>')) return block;
			const lines = block.split('\n');
			if (lines.length > 0 && lines.every((line) => line.startsWith('# '))) {
				return lines.map((line) => `<h1>${inline(line.slice(2))}</h1>`).join('');
			}
			if (lines.length > 0 && lines.every((line) => line.startsWith('## '))) {
				return lines.map((line) => `<h2>${inline(line.slice(3))}</h2>`).join('');
			}
			if (lines.length > 0 && lines.every((line) => line.startsWith('- '))) {
				return `<ul>${lines.map((line) => `<li>${inline(line.slice(2))}</li>`).join('')}</ul>`;
			}
			return `<p>${lines.map((line) => inline(line)).join('<br>')}</p>`;
		})
		.join('\n');
}
