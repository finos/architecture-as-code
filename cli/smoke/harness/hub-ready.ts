/**
 * Polls the CalmHub Swagger UI until it responds 200 or the timeout elapses.
 * /q/swagger-ui is available as soon as Quarkus finishes starting, regardless
 * of DB profile (unlike /q/health/ready). Mirrors calm-hub/smoke-test.sh.
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
            const res = await fetch(`${baseUrl}/q/swagger-ui`, { signal: AbortSignal.timeout(intervalMs) });
            if (res.ok) return;
            lastErr = new Error(`status ${res.status}`);
        } catch (err) {
            lastErr = err;
        }
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`CalmHub at ${baseUrl} not ready after ${timeoutMs}ms: ${String(lastErr)}`);
}
