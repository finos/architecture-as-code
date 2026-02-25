import path from 'path';
import fs from 'fs';

export function readUrlMappingFile(urlMappingPath?: string): Map<string, string> {
    if (!urlMappingPath) {
        return new Map<string, string>();
    }

    const basePath = path.dirname(urlMappingPath);
    const mappingJson = JSON.parse(fs.readFileSync(urlMappingPath, 'utf-8'));

    return new Map(
        Object.entries(mappingJson).map(([url, relativePath]) => [
            url,
            path.resolve(basePath, String(relativePath))
        ])
    );
}

