// Screenshot helpers: capture (full window or selector-cropped), write to disk,
// produce a manifest entry. The orchestrator owns the manifest lifecycle.

import { writeFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import type { Page } from 'playwright'
import { DEFAULT_VIEWPORT } from './normalise.js'

export interface ManifestEntry {
    name: string
    width: number
    height: number
    bytes: number
    sha256: string
}

export interface CaptureOptions {
    // If provided, crop the screenshot to this CSS selector's bounding box.
    cropToSelector?: string
    // Pad the crop region by this many pixels on each side (default 0).
    cropPadding?: number
}

export async function captureFullWindow(window: Page): Promise<Buffer> {
    return await window.screenshot({ type: 'png' })
}

export async function captureCropped(window: Page, opts: CaptureOptions): Promise<Buffer> {
    if (!opts.cropToSelector) {
        return await captureFullWindow(window)
    }

    const handle = await window.waitForSelector(opts.cropToSelector, { timeout: 5_000 })
    const box = await handle.boundingBox()
    if (!box) {
        throw new Error(`Selector ${opts.cropToSelector} has no bounding box`)
    }

    const pad = opts.cropPadding ?? 0
    const x = Math.max(0, Math.floor(box.x - pad))
    const y = Math.max(0, Math.floor(box.y - pad))
    const clip = {
        x,
        y,
        // Clamp the clip extent to what remains of the viewport from the
        // origin — clamping width to DEFAULT_VIEWPORT.width alone allows
        // x + width to exceed the viewport when x > 0.
        width: Math.min(DEFAULT_VIEWPORT.width - x, Math.ceil(box.width + pad * 2)),
        height: Math.min(DEFAULT_VIEWPORT.height - y, Math.ceil(box.height + pad * 2)),
    }

    return await window.screenshot({ type: 'png', clip })
}

export function writePng(filePath: string, png: Buffer): ManifestEntry {
    writeFileSync(filePath, png)
    const stat = statSync(filePath)
    const sha256 = createHash('sha256').update(png).digest('hex')
    const { width, height } = readPngDimensions(png)
    return {
        name: path.basename(filePath),
        width,
        height,
        bytes: stat.size,
        sha256,
    }
}

// PNG dimensions are at fixed offsets in the IHDR chunk: bytes 16-19 = width,
// 20-23 = height (big-endian). No need for a full PNG decoder. The full PNG
// magic is 8 bytes starting with 0x89 'P' 'N' 'G'; we check the magic byte
// and the ASCII signature together to match the smoke test's assertion.
function readPngDimensions(png: Buffer): { width: number; height: number } {
    const isPng =
        png.length >= 24 && png[0] === 0x89 && png.toString('ascii', 1, 4) === 'PNG'
    if (!isPng) {
        throw new Error('Buffer is not a PNG')
    }
    const width = png.readUInt32BE(16)
    const height = png.readUInt32BE(20)
    return { width, height }
}
