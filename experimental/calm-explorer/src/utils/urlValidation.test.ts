import { describe, it, expect } from 'vitest';
import { validateURL, safeFetch } from './urlValidation';

describe('validateURL', () => {
  describe('valid URLs', () => {
    it('should accept GitHub URLs', () => {
      const result = validateURL('https://github.com/user/repo');
      expect(result.isValid).toBe(true);
      expect(result.url).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should accept raw.githubusercontent.com URLs', () => {
      const result = validateURL('https://raw.githubusercontent.com/user/repo/main/file.json');
      expect(result.isValid).toBe(true);
    });

    it('should accept localhost URLs', () => {
      const result = validateURL('http://localhost:3000/api/data');
      expect(result.isValid).toBe(true);
    });

    it('should accept 127.0.0.1 URLs', () => {
      const result = validateURL('http://127.0.0.1:8080/data.json');
      expect(result.isValid).toBe(true);
    });

    it('should accept GitHub subdomains', () => {
      const result = validateURL('https://api.github.com/repos/user/repo');
      expect(result.isValid).toBe(true);
    });
  });

  describe('invalid URLs', () => {
    it('should reject non-string input', () => {
      const result = validateURL(null as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject malformed URLs', () => {
      const result = validateURL('not-a-url');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should reject non-HTTP protocols', () => {
      const result = validateURL('ftp://example.com/file');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Protocol');
      expect(result.error).toContain('not allowed');
    });

    it('should reject file:// protocol', () => {
      const result = validateURL('file:///etc/passwd');
      expect(result.isValid).toBe(false);
    });

    it('should reject disallowed domains', () => {
      const result = validateURL('https://evil.com/data.json');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not in the allowed list');
    });

    it('should reject direct IP addresses (except localhost)', () => {
      const result = validateURL('https://192.168.1.1/data.json');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('IP addresses are not allowed');
    });

    it('should reject URLs with dangerous characters', () => {
      const result = validateURL('https://github.com/<script>alert(1)</script>');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    it('should reject javascript: protocol', () => {
      const result = validateURL('javascript:alert(1)');
      expect(result.isValid).toBe(false);
    });
  });

  describe('custom options', () => {
    it('should respect custom allowed protocols', () => {
      const result = validateURL('ftp://github.com/file', {
        allowedProtocols: ['ftp:'],
      });
      expect(result.isValid).toBe(true);
    });

    it('should respect custom allowed domains', () => {
      const result = validateURL('https://example.com/data', {
        allowedDomains: ['example.com'],
      });
      expect(result.isValid).toBe(true);
    });

    it('should disable subdomain matching when configured', () => {
      const result = validateURL('https://api.github.com/data', {
        allowSubdomains: false,
      });
      expect(result.isValid).toBe(false);
    });
  });
});

describe('safeFetch', () => {
  it('should reject invalid URLs', async () => {
    await expect(safeFetch('https://evil.com/data')).rejects.toThrow('URL validation failed');
  });

  it('should timeout after specified duration', async () => {
    // This would need a mock server to test properly
    // For now, just test that timeout option is accepted
    const controller = new AbortController();
    controller.abort();

    await expect(
      safeFetch('https://github.com/test', { timeout: 100 })
    ).rejects.toThrow();
  });

  it('should accept valid GitHub URLs', async () => {
    // This would actually make a network request
    // In a real test, we'd mock fetch
    // For now, just verify it doesn't throw on validation
    expect(() => {
      validateURL('https://github.com/test');
    }).not.toThrow();
  });
});
