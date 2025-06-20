import { promises as fsPromises } from 'fs';
import * as path from 'path';

export async function getAllFiles(dir: string): Promise<string[]> {
    const dirents = await fsPromises.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
        dirents.map((dirent) => {
            const res = path.resolve(dir, dirent.name);
            return dirent.isDirectory() ? getAllFiles(res) : res;
        })
    );
    return files.flat();
}

export function relativeFilePath(baseDir: string, fullPath: string): string {
    return path.relative(baseDir, fullPath);
}

export async function expectDirectoryMatch(expectedDir: string, actualDir: string): Promise<void> {
    const actualFiles = await getAllFiles(actualDir);
    const expectedFiles = await getAllFiles(expectedDir);

    const actualRelPaths = new Set(actualFiles.map(f => relativeFilePath(actualDir, f)));
    const expectedRelPaths = new Set(expectedFiles.map(f => relativeFilePath(expectedDir, f)));

    expect(actualRelPaths).toEqual(expectedRelPaths);

    for (const relPath of expectedRelPaths) {
        const actualContent = await fsPromises.readFile(path.join(actualDir, relPath), 'utf-8');
        const expectedContent = await fsPromises.readFile(path.join(expectedDir, relPath), 'utf-8');
        expect(actualContent).toEqual(expectedContent);
    }
}
