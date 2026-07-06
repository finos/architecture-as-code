import * as fs from 'fs';
import path from 'path';

/** Write `obj` as pretty-printed JSON, creating parent directories as needed. */
export function writeJson(filePath: string, obj: object): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

/** Read and parse a JSON file. */
export function readJson(filePath: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/** Read a JSON file, apply an in-place mutation, and write it back. */
export function patchJson(filePath: string, patchFn: (o: Record<string, unknown>) => void): void {
    const obj = readJson(filePath);
    patchFn(obj);
    writeJson(filePath, obj);
}
