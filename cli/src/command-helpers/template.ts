import path from 'path';
import fs from 'node:fs';

export function getUrlToLocalFileMap(urlToLocalFileMapping?: string): Map<string, string> {
    if (!urlToLocalFileMapping) {
        return new Map<string, string>();
    }

    try {
        const basePath = path.dirname(urlToLocalFileMapping);
        const mappingJson = JSON.parse(fs.readFileSync(urlToLocalFileMapping, 'utf-8'));

        return new Map(
            Object.entries(mappingJson).map(([url, relativePath]) => [
                url,
                path.resolve(basePath, String(relativePath))
            ])
        );
    } catch (err) {
        console.error(`Error reading url to local file mapping file: ${urlToLocalFileMapping}`, err);
        process.exit(1);
    }
}
