/**
 * Polls CalmHub until a MongoDB-backed endpoint responds 200 or the timeout elapses.
 * /q/swagger-ui responds without MongoDB, so it does not show a dead database.
 */
export async function waitForHub(
    baseUrl: string,
    timeoutMs = 120_000,
    intervalMs = 3_000
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastErr: unknown;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`${baseUrl}/api/calm/namespaces`, { signal: AbortSignal.timeout(intervalMs) });
            if (res.ok) return;
            lastErr = new Error(`status ${res.status}`);
        } catch (err) {
            lastErr = err;
        }
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`CalmHub at ${baseUrl} not ready after ${timeoutMs}ms: ${String(lastErr)}`);
}
