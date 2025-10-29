export interface GitHubFile {
  path: string;
  type: 'file' | 'dir';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTreeResponse {
  tree: Array<{
    path: string;
    mode: string;
    type: string;
    sha: string;
    size?: number;
    url: string;
  }>;
  truncated: boolean;
}

export class GitHubService {
  private token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Get the file tree for a repository
   */
  async getRepoTree(owner: string, repo: string, branch: string = 'main'): Promise<GitHubFile[]> {
    try {
      // First, get the default branch if not specified
      const repoResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers: this.getHeaders() }
      );

      if (!repoResponse.ok) {
        // Try 'master' if 'main' fails
        if (branch === 'main') {
          return this.getRepoTree(owner, repo, 'master');
        }

        // Provide user-friendly error messages
        if (repoResponse.status === 404) {
          throw new Error(`Repository "${owner}/${repo}" not found. Please check the owner and repository name.`);
        } else if (repoResponse.status === 403) {
          throw new Error(`Access denied to "${owner}/${repo}". This may be a private repository - try adding a personal access token.`);
        } else if (repoResponse.status === 401) {
          throw new Error(`Authentication failed. Please check your personal access token.`);
        }
        throw new Error(`Failed to fetch repository: ${repoResponse.statusText}`);
      }

      const repoData = await repoResponse.json();
      const defaultBranch = repoData.default_branch;

      // Get the tree
      const treeResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
        { headers: this.getHeaders() }
      );

      if (!treeResponse.ok) {
        throw new Error(`Failed to fetch file tree: ${treeResponse.statusText}`);
      }

      const treeData: GitHubTreeResponse = await treeResponse.json();

      // Filter for JSON files and convert to our format
      return treeData.tree
        .filter(item => item.type === 'blob' && item.path.endsWith('.json'))
        .map(item => ({
          path: item.path,
          type: 'file' as const,
          sha: item.sha,
          size: item.size,
          url: item.url,
        }));
    } catch (error) {
      console.error('Error fetching repo tree:', error);
      throw error;
    }
  }

  /**
   * Get the content of a specific file
   */
  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    try {
      console.log(`Fetching file: ${owner}/${repo}/${path}`);

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        { headers: this.getHeaders() }
      );

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Error response:', errorBody);
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Response data keys:', Object.keys(data));

      // GitHub returns base64 encoded content
      if (data.content) {
        const decoded = atob(data.content.replace(/\n/g, ''));
        console.log('Decoded content length:', decoded.length);
        console.log('First 100 chars:', decoded.substring(0, 100));
        return decoded;
      }

      throw new Error('No content found in response');
    } catch (error) {
      console.error('Error fetching file content:', error);
      throw error;
    }
  }

  /**
   * Check if a file is likely a CALM file by examining its content
   */
  static isCALMFile(content: string): boolean {
    try {
      const parsed = JSON.parse(content);
      // Check for CALM-specific properties
      return !!(
        parsed.nodes ||
        parsed.relationships ||
        parsed.$schema?.includes('calm') ||
        parsed.metadata?.name
      );
    } catch {
      return false;
    }
  }
}

/**
 * Secure token encryption utility using Web Crypto API
 */
class TokenEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;

  // Derive a key from a passphrase
  private static async deriveKey(passphrase: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Use a static salt (not ideal, but acceptable for client-side encryption as defense-in-depth)
    const salt = encoder.encode('calm-viz-salt-v1');

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Generate a passphrase based on browser session
  private static async getPassphrase(): Promise<string> {
    // Use a combination of factors as passphrase
    const factors = [
      navigator.userAgent,
      navigator.language,
      new Date().toDateString(), // Changes daily, providing auto-expiration
      'calm-viz-secret-key-v1',
    ];
    return factors.join('::');
  }

  static async encrypt(token: string): Promise<string> {
    try {
      const passphrase = await this.getPassphrase();
      const key = await this.deriveKey(passphrase);
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

      const encrypted = await crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv },
        key,
        encoder.encode(token)
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Convert to base64 for storage
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt token');
    }
  }

  static async decrypt(encryptedData: string): Promise<string> {
    try {
      const passphrase = await this.getPassphrase();
      const key = await this.deriveKey(passphrase);

      // Decode from base64
      const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt token');
    }
  }
}

/**
 * Secure SessionStorage management for GitHub token
 * Uses sessionStorage instead of localStorage for auto-expiration on browser close
 * Encrypts tokens before storage for defense-in-depth
 */
export const GitHubTokenStorage = {
  KEY: 'github_token_enc',

  async save(token: string): Promise<void> {
    try {
      const encrypted = await TokenEncryption.encrypt(token);
      sessionStorage.setItem(this.KEY, encrypted);
    } catch (error) {
      console.error('Failed to save token:', error);
      throw new Error('Failed to save token securely');
    }
  },

  async load(): Promise<string | null> {
    try {
      const encrypted = sessionStorage.getItem(this.KEY);
      if (!encrypted) return null;

      return await TokenEncryption.decrypt(encrypted);
    } catch (error) {
      console.error('Failed to load token:', error);
      // If decryption fails, remove the corrupted data
      this.remove();
      return null;
    }
  },

  remove(): void {
    sessionStorage.removeItem(this.KEY);
  },
};
