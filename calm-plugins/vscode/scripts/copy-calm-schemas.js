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
        const calmDir = path.join(repoRoot, 'calm')
        const dest = path.join(__dirname, '..', 'dist', 'calm')

        // Copy release schemas
        const releaseDir = path.join(calmDir, 'release')
        if (fs.existsSync(releaseDir)) {
            const releases = await fs.promises.readdir(releaseDir, { withFileTypes: true })
            for (const release of releases) {
                if (release.isDirectory()) {
                    const metaDir = path.join(releaseDir, release.name, 'meta')
                    if (fs.existsSync(metaDir)) {
                        const destMetaDir = path.join(dest, 'release', release.name, 'meta')
                        await copyDir(metaDir, destMetaDir)
                        console.log(`Copied release/${release.name}/meta`)
                    }
                }
            }
        }

        // Copy draft schemas
        const draftDir = path.join(calmDir, 'draft')
        if (fs.existsSync(draftDir)) {
            const drafts = await fs.promises.readdir(draftDir, { withFileTypes: true })
            for (const draft of drafts) {
                if (draft.isDirectory()) {
                    const metaDir = path.join(draftDir, draft.name, 'meta')
                    if (fs.existsSync(metaDir)) {
                        const destMetaDir = path.join(dest, 'draft', draft.name, 'meta')
                        await copyDir(metaDir, destMetaDir)
                        console.log(`Copied draft/${draft.name}/meta`)
                    }
                }
            }
        }

        console.log('CALM schemas copied to', dest)
    } catch (e) {
        console.error('Failed to copy CALM schemas:', e)
        process.exit(1)
    }
}

main()
