// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openFile, saveFile, downloadDataUrl } from '$lib/io/fileSystem';

// ─── openFile tests ───────────────────────────────────────────────────────────

describe('openFile', () => {
	beforeEach(() => {
		// Ensure showOpenFilePicker is NOT in window (fallback path)
		// Using delete so that 'showOpenFilePicker' in window is false
		delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('fallback: when showOpenFilePicker is not in window, creates an input element and reads file content', async () => {
		const fileContent = '{"nodes":[],"relationships":[]}';
		const mockFile = new File([fileContent], 'test.calm', { type: 'application/json' });

		const mockInput = {
			type: '',
			accept: '',
			click: vi.fn(),
			onchange: null as ((event: Event) => void) | null,
			files: [mockFile],
		};

		const createElementSpy = vi
			.spyOn(document, 'createElement')
			.mockReturnValue(mockInput as unknown as HTMLElement);

		// Trigger the input change synchronously after click
		mockInput.click.mockImplementation(() => {
			const event = new Event('change');
			if (mockInput.onchange) mockInput.onchange(event);
		});

		// Mock FileReader
		const mockReader = {
			readAsText: vi.fn(),
			onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
			result: fileContent,
		};
		vi.stubGlobal(
			'FileReader',
			vi.fn(() => {
				mockReader.readAsText.mockImplementation(() => {
					const event = { target: mockReader } as ProgressEvent<FileReader>;
					if (mockReader.onload) mockReader.onload(event);
				});
				return mockReader;
			}),
		);

		const result = await openFile();

		expect(createElementSpy).toHaveBeenCalledWith('input');
		expect(result.content).toBe(fileContent);
		expect(result.name).toBe('test.calm');
		expect(result.handle).toBeNull();
	});
});

// ─── saveFile tests ───────────────────────────────────────────────────────────

describe('saveFile', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('fallback: when showSaveFilePicker is not in window and handle is null, creates Blob download via anchor', async () => {
		// Ensure showSaveFilePicker is NOT in window (fallback path)
		delete (window as unknown as Record<string, unknown>).showSaveFilePicker;

		const mockObjectUrl = 'blob:mock-url';
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn().mockReturnValue(mockObjectUrl),
			revokeObjectURL: vi.fn(),
		});

		const mockAnchor = {
			href: '',
			download: '',
			click: vi.fn(),
			style: {},
		};
		vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
		vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
		vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

		const result = await saveFile('{"nodes":[]}', null, 'arch.calm');

		expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
		expect(mockAnchor.click).toHaveBeenCalled();
		expect(mockAnchor.download).toBe('arch.calm');
		expect(URL.revokeObjectURL).toHaveBeenCalled();
		// fallback returns null (no handle)
		expect(result).toBeNull();
	});

	it('with handle: calls handle.createWritable(), writes content, closes writable', async () => {
		const mockWritable = {
			write: vi.fn().mockResolvedValue(undefined),
			close: vi.fn().mockResolvedValue(undefined),
		};
		const mockHandle = {
			createWritable: vi.fn().mockResolvedValue(mockWritable),
		} as unknown as FileSystemFileHandle;

		const content = '{"nodes":[]}';
		const result = await saveFile(content, mockHandle, 'arch.calm');

		expect(mockHandle.createWritable).toHaveBeenCalled();
		expect(mockWritable.write).toHaveBeenCalledWith(content);
		expect(mockWritable.close).toHaveBeenCalled();
		expect(result).toBe(mockHandle);
	});
});

// ─── downloadDataUrl tests ────────────────────────────────────────────────────

describe('downloadDataUrl', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('creates an anchor with href and download attributes and clicks it', () => {
		const mockAnchor = {
			href: '',
			download: '',
			click: vi.fn(),
			style: {},
		};
		const createElementSpy = vi
			.spyOn(document, 'createElement')
			.mockReturnValue(mockAnchor as unknown as HTMLElement);
		vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
		vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

		const dataUrl = 'data:image/png;base64,abc123';
		const filename = 'diagram.png';

		downloadDataUrl(dataUrl, filename);

		expect(createElementSpy).toHaveBeenCalledWith('a');
		expect(mockAnchor.href).toBe(dataUrl);
		expect(mockAnchor.download).toBe(filename);
		expect(mockAnchor.click).toHaveBeenCalled();
	});
});
