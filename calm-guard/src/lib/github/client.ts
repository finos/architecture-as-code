import https from 'node:https';

const GITHUB_API_HOST = 'api.github.com';

/**
 * Encode each segment of a repository file path for use in a GitHub API URL.
 */
export function encodeRepoPath(filePath: string): string {
  return filePath.split('/').map(encodeURIComponent).join('/');
}

/**
 * GitHub REST API wrapper — server-side only.
 * Uses Node.js native https to bypass Next.js fetch caching.
 * Works without token for public repos (unauthenticated — lower rate limits).
 *
 * NEVER call this from client components — GITHUB_TOKEN must stay server-side.
 */
export async function githubFetch(
  path: string,
  options: { token?: string; method?: string; body?: string } = {},
): Promise<Response> {
  const { token, method = 'GET', body } = options;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'calmguard/1.2',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  return new Promise<Response>((resolve, reject) => {
    // A fixed hostname keeps the request (and the token) on the GitHub API, whatever the path holds.
    const req = https.request({ hostname: GITHUB_API_HOST, path, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString('utf-8');
        const status = res.statusCode ?? 500;
        resolve(new Response(responseBody, {
          status,
          statusText: res.statusMessage ?? '',
          headers: new Headers(res.headers as Record<string, string>),
        }));
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
