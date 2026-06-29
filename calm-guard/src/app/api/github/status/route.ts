import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/github/status
 *
 * Returns GitHub integration status.
 * - enabled: always true (public repos work without auth)
 * - authEnabled: whether GITHUB_TOKEN is set (needed for PR creation)
 *
 * Response: { enabled: boolean, authEnabled: boolean }
 */
export async function GET(): Promise<Response> {
  return NextResponse.json({
    enabled: true,
    authEnabled: !!process.env.GITHUB_TOKEN,
  });
}
