/**
 * URL validation utility for security
 * Validates URLs before fetching to prevent SSRF and other attacks
 */

import { TIMEOUTS } from './constants';

const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const ALLOWED_DOMAINS = [
  // GitHub domains
  'github.com',
  'raw.githubusercontent.com',
  'gist.githubusercontent.com',
  // Allow localhost for development
  'localhost',
  '127.0.0.1',
];

export interface URLValidationResult {
  isValid: boolean;
  error?: string;
  url?: URL;
}

/**
 * Validates a URL for safe fetching
 * @param urlString - The URL string to validate
 * @param options - Validation options
 * @returns Validation result with parsed URL if valid
 */
export function validateURL(
  urlString: string,
  options: {
    allowedProtocols?: string[];
    allowedDomains?: string[];
    allowSubdomains?: boolean;
  } = {}
): URLValidationResult {
  const {
    allowedProtocols = ALLOWED_PROTOCOLS,
    allowedDomains = ALLOWED_DOMAINS,
    allowSubdomains = true,
  } = options;

  // Basic validation
  if (!urlString || typeof urlString !== 'string') {
    return { isValid: false, error: 'URL must be a non-empty string' };
  }

  // Try to parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }

  // Validate protocol
  if (!allowedProtocols.includes(url.protocol)) {
    return {
      isValid: false,
      error: `Protocol '${url.protocol}' not allowed. Allowed protocols: ${allowedProtocols.join(', ')}`,
    };
  }

  // Validate hostname
  const hostname = url.hostname.toLowerCase();

  // Check for IP address patterns (to prevent bypasses)
  const isIPAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

  // Allow localhost IPs for development
  if (isIPAddress && !['127.0.0.1', 'localhost'].includes(hostname)) {
    return {
      isValid: false,
      error: 'Direct IP addresses are not allowed for security reasons',
    };
  }

  // Check if domain is in allowed list
  const isDomainAllowed = allowedDomains.some((allowedDomain) => {
    if (allowSubdomains) {
      // Allow exact match or subdomain
      return hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`);
    } else {
      // Exact match only
      return hostname === allowedDomain;
    }
  });

  if (!isDomainAllowed) {
    return {
      isValid: false,
      error: `Domain '${hostname}' is not in the allowed list. Allowed domains: ${allowedDomains.join(', ')}`,
    };
  }

  // Additional security checks

  // Check for unusual characters in URL
  if (urlString.includes('<') || urlString.includes('>') || urlString.includes('"')) {
    return {
      isValid: false,
      error: 'URL contains invalid characters',
    };
  }

  // All checks passed
  return { isValid: true, url };
}

/**
 * Safe fetch wrapper with URL validation and timeout
 * @param urlString - The URL to fetch
 * @param options - Fetch options with additional validation options
 * @returns Promise with fetch response
 */
export async function safeFetch(
  urlString: string,
  options: RequestInit & {
    timeout?: number;
    allowedProtocols?: string[];
    allowedDomains?: string[];
  } = {}
): Promise<Response> {
  // Extract custom options
  const {
    timeout = TIMEOUTS.FETCH_TIMEOUT,
    allowedProtocols,
    allowedDomains,
    ...fetchOptions
  } = options;

  // Validate URL
  const validation = validateURL(urlString, { allowedProtocols, allowedDomains });
  if (!validation.isValid) {
    throw new Error(`URL validation failed: ${validation.error}`);
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(urlString, {
      ...fetchOptions,
      signal: controller.signal,
    });

    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
