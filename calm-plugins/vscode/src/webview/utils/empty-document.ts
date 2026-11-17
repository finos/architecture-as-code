export function isEmptyDocument(json: string | null): boolean {
    if (json === null || json.trim() === '') return true;
    try {
        const parsed: unknown = JSON.parse(json);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && Object.keys(parsed).length === 0;
    } catch {
        return false;
    }
}
