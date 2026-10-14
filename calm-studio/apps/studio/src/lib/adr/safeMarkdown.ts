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

/** Split a GFM row. `\|` is a literal pipe. Returns null when the line is not a row. */
function splitTableRow(line: string): string[] | null {
	const trimmed = line.trim();
	if (!trimmed.includes('|')) return null;
	let body = trimmed;
	if (body.startsWith('|')) body = body.slice(1);
	if (body.endsWith('|')) body = body.slice(0, -1);
	const cells: string[] = [];
	let current = '';
	for (let i = 0; i < body.length; i++) {
		if (body[i] === '\\' && body[i + 1] === '|') {
			current += '|';
			i += 1;
			continue;
		}
		if (body[i] === '|') {
			cells.push(current.trim());
			current = '';
			continue;
		}
		current += body[i];
	}
	cells.push(current.trim());
	return cells;
}

function columnAlign(cell: string): 'left' | 'right' | 'center' | null {
	if (!/^:?-{3,}:?$/.test(cell)) return null;
	const left = cell.startsWith(':');
	const right = cell.endsWith(':');
	if (left && right) return 'center';
	if (right) return 'right';
	return 'left';
}

function renderTable(lines: string[], start: number): { html: string; next: number } | null {
	const header = splitTableRow(lines[start] ?? '');
	const delimiter = splitTableRow(lines[start + 1] ?? '');
	if (!header || !delimiter || delimiter.length === 0) return null;
	const align = delimiter.map((cell) => columnAlign(cell));
	if (align.some((value) => value === null)) return null;
	const columns = align.length;
	const body: string[][] = [];
	let next = start + 2;
	while (next < lines.length) {
		const row = splitTableRow(lines[next] ?? '');
		if (!row) break;
		body.push(row);
		next += 1;
	}
	const cell = (tag: 'th' | 'td', text: string, side: 'left' | 'right' | 'center') => {
		const style = side === 'left' ? '' : ` style="text-align:${side}"`;
		return `<${tag}${style}>${inline(text)}</${tag}>`;
	};
	const head = align
		.map((side, index) => cell('th', header[index] ?? '', side ?? 'left'))
		.join('');
	const rows = body
		.map(
			(row) =>
				`<tr>${align.map((side, index) => cell('td', row[index] ?? '', side ?? 'left')).join('')}</tr>`
		)
		.join('');
	return {
		html: `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`,
		next,
	};
}

function renderFlow(lines: string[]): string {
	if (lines.length === 0) return '';
	if (lines.every((line) => line.startsWith('# '))) {
		return lines.map((line) => `<h1>${inline(line.slice(2))}</h1>`).join('');
	}
	if (lines.every((line) => line.startsWith('## '))) {
		return lines.map((line) => `<h2>${inline(line.slice(3))}</h2>`).join('');
	}
	if (lines.every((line) => line.startsWith('- '))) {
		return `<ul>${lines.map((line) => `<li>${inline(line.slice(2))}</li>`).join('')}</ul>`;
	}
	return `<p>${lines.map((line) => inline(line)).join('<br>')}</p>`;
}

function renderBlock(block: string): string {
	if (block.startsWith('<pre>')) return block;
	const lines = block.split('\n');
	const parts: string[] = [];
	const flow: string[] = [];
	const flush = () => {
		if (flow.length === 0) return;
		parts.push(renderFlow(flow));
		flow.length = 0;
	};
	for (let index = 0; index < lines.length; ) {
		const table = renderTable(lines, index);
		if (table && table.next > index + 1) {
			flush();
			parts.push(table.html);
			index = table.next;
			continue;
		}
		flow.push(lines[index] ?? '');
		index += 1;
	}
	flush();
	return parts.join('');
}

export function renderSafeMarkdown(source: string): string {
	const escaped = escapeHtml(source.replace(/\r\n/g, '\n'));
	const withCode = escaped.replace(/```([\s\S]*?)```/g, (_match, code: string) => {
		return `<pre><code>${code.replace(/^\n|\n$/g, '')}</code></pre>`;
	});
	return withCode
		.split(/\n{2,}/)
		.map((block) => renderBlock(block))
		.join('\n');
}
