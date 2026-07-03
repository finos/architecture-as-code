import * as fs from 'fs';
import path from 'path';
import { SMOKE_HUB_URL } from '../global-setup';

/** Canonical CalmHub document $id, e.g. .../namespaces/smoke-crud/architectures/svc/versions/1.0.0 */
export function hubDocId(
    namespace: string,
    type: string,
    mapping: string,
    version: string,
    baseUrl: string = SMOKE_HUB_URL
): string {
    return `${baseUrl}/calm/namespaces/${namespace}/${type}/${mapping}/versions/${version}`;
}

export function writeJson(filePath: string, obj: object): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

export function readJson(filePath: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function patchJson(filePath: string, patchFn: (o: Record<string, unknown>) => void): void {
    const obj = readJson(filePath);
    patchFn(obj);
    writeJson(filePath, obj);
}
