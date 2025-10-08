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

async function main() {
    try {
    const repoRoot = path.resolve(__dirname, '..', '..', '..') // calm-plugins/vscode/scripts -> repository root
        // Prefer copying the built/packaged widgets output if present (calm-widgets/dist/cli/widgets)
        const builtWidgetSrc = path.join(repoRoot, 'calm-widgets', 'dist', 'cli', 'widgets')
        const srcWidgetSrc = path.join(repoRoot, 'calm-widgets', 'src', 'widgets')
        const dest = path.join(__dirname, '..', 'dist', 'widgets')
        let widgetSrc = null
        if (fs.existsSync(builtWidgetSrc)) {
            widgetSrc = builtWidgetSrc
            console.log('Using built widgets from', builtWidgetSrc)
        } else if (fs.existsSync(srcWidgetSrc)) {
            widgetSrc = srcWidgetSrc
            console.log('Using source widgets from', srcWidgetSrc)
        } else {
            console.error('Widget source directory not found (checked built and src paths):')
            console.error('  ' + builtWidgetSrc)
            console.error('  ' + srcWidgetSrc)
            process.exit(1)
        }
        await copyDir(widgetSrc, dest)
        console.log('Widgets copied to', dest)
    } catch (e) {
        console.error('Failed to copy widgets:', e)
        process.exit(1)
    }
}

main()
