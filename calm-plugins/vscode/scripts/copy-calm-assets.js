const fs = require('fs')
const path = require('path')

async function copyDir(src, dest) {
    await fs.promises.mkdir(dest, { recursive: true })
    const entries = await fs.promises.readdir(src, { withFileTypes: true })
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)
        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath)
        } else if (entry.isFile()) {
            await fs.promises.copyFile(srcPath, destPath)
        }
    }
}

async function copyWidgets(repoRoot, distDir) {
    const builtWidgetSrc = path.join(repoRoot, 'calm-widgets', 'dist', 'cli', 'widgets')
    const srcWidgetSrc = path.join(repoRoot, 'calm-widgets', 'src', 'widgets')
    const widgetDest = path.join(distDir, 'widgets')

    let widgetSrc = null
    if (fs.existsSync(builtWidgetSrc)) {
        widgetSrc = builtWidgetSrc
        console.log('Using built widgets from', builtWidgetSrc)
    } else if (fs.existsSync(srcWidgetSrc)) {
        widgetSrc = srcWidgetSrc
        console.log('Using source widgets from', srcWidgetSrc)
    } else {
        throw new Error(`Widget source directory not found:\n  ${builtWidgetSrc}\n  ${srcWidgetSrc}`)
    }

    await copyDir(widgetSrc, widgetDest)
    console.log('Widgets copied to', widgetDest)
}

async function copyTemplateBundles(repoRoot, distDir) {
    const templateBundleSrc = path.join(repoRoot, 'shared', 'dist', 'template-bundles')
    const templateBundleDest = path.join(distDir, 'template-bundles')

    if (fs.existsSync(templateBundleSrc)) {
        await copyDir(templateBundleSrc, templateBundleDest)
        console.log('Template bundles copied to', templateBundleDest)
    } else {
        console.warn('Template bundles not found at', templateBundleSrc)
        console.warn('Run "npm run build" in shared package first')
    }
}

async function main() {
    try {
        const repoRoot = path.resolve(__dirname, '..', '..', '..')
        const distDir = path.join(__dirname, '..', 'dist')

        await copyWidgets(repoRoot, distDir)
        await copyTemplateBundles(repoRoot, distDir)
    } catch (e) {
        console.error('Failed to copy CALM assets:', e.message || e)
        process.exit(1)
    }
}

main()
