import { z } from 'zod';

// Input schema for fetching a CALM file from GitHub
export const githubFetchInputSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  filePath: z.string().min(1, 'File path is required'),
});
export type GitHubFetchInput = z.infer<typeof githubFetchInputSchema>;

// GitHub Contents API response shape (only fields we need)
export const githubContentsResponseSchema = z.object({
  content: z.string(),           // base64-encoded file content
  encoding: z.literal('base64'),
  sha: z.string(),               // file blob SHA (needed for remediation PR later)
  name: z.string(),
  path: z.string(),
});
export type GitHubContentsResponse = z.infer<typeof githubContentsResponseSchema>;

// GitHub repo info response (to get default branch)
export const githubRepoResponseSchema = z.object({
  default_branch: z.string(),
  full_name: z.string(),
});
export type GitHubRepoResponse = z.infer<typeof githubRepoResponseSchema>;

// PR record for Zustand store — used by Plans 02 and 03
export interface PRRecord {
  type: 'pipeline' | 'remediation' | 'infra';
  status: 'idle' | 'generating' | 'open' | 'error';
  step?: string;
  branchName?: string;
  prUrl?: string;
  prNumber?: number;
  fileCount?: number;
  error?: string;
}
