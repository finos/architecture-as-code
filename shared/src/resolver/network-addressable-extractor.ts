export interface AddressableEntry {
    path: string;
    key: string;
    value: string;
}

const URL_REGEX = /https?:\/\/[^\s"']+/g;

export function extractNetworkAddressables(jsonString: string): AddressableEntry[] {
    let data: unknown;
    try {
        data = JSON.parse(jsonString);
    } catch (err) {
        throw new Error(`Invalid JSON string provided: ${err.message}`);
    }
    const results: AddressableEntry[] = [];
    traverse(data, 'root', results);
    return results;
}

function traverse(current: unknown, path: string, results: AddressableEntry[]): void {
    if (typeof current === 'string') {
        pushUrls(path, extractKey(path), current, results);
        return;
    }

    if (Array.isArray(current)) {
        current.forEach((item, idx) => traverse(item, `${path}[${idx}]`, results));
        return;
    }

    if (current && typeof current === 'object') {
        const obj = current as Record<string, unknown>;
        for (const [key, value] of Object.entries(obj)) {
            const keyPath = `${path}.${key}`;
            pushUrls(keyPath, key, key, results);
            if (typeof value === 'string') {
                pushUrls(keyPath, key, value, results);
            } else if (value) {
                traverse(value, keyPath, results);
            }
        }
    }
}

function extractKey(path: string): string {
    const match = path.match(/(?:\.([^.[\]]+)|\[(\d+)])$/);
    return match ? (match[1] ?? match[2]!) : '';
}

function pushUrls(path: string, key: string, text: string, results: AddressableEntry[]) {
    const matches = text.match(URL_REGEX);
    matches?.forEach(url => results.push({ path, key, value: url }));
}
