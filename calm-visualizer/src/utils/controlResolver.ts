import type { FileMappings, ControlConfiguration, CALMArchitecture, CALMControl, ResolvedControl } from '@/types/calm';

export class ControlResolver {
  private fileMappings: FileMappings | null = null;
  private controlCache: Map<string, ControlConfiguration> = new Map();
  private baseUrl: string = '';

  /**
   * Load file mappings that redirect URLs to local files
   */
  loadFileMappings(mappings: FileMappings, baseUrl: string = ''): void {
    this.fileMappings = mappings;
    this.baseUrl = baseUrl;
    // Clear cache when new mappings are loaded
    this.controlCache.clear();
  }

  /**
   * Resolve a control configuration from a URL
   * Tries URL first, then falls back to file mappings
   */
  async resolveControl(url: string): Promise<ControlConfiguration | null> {
    // Check cache first
    const cacheKey = this.getCacheKey(url);
    if (this.controlCache.has(cacheKey)) {
      return this.controlCache.get(cacheKey)!;
    }

    try {
      // Extract URL without fragment
      const { urlWithoutFragment, fragment } = this.parseUrl(url);

      // Try file mapping first if available
      if (this.fileMappings) {
        const mappedPath = this.getMappedPath(urlWithoutFragment);
        if (mappedPath) {
          const config = await this.fetchFromFile(mappedPath);
          if (config) {
            this.controlCache.set(cacheKey, config);
            return config;
          }
        }
      }

      // Fall back to fetching from URL (if not a local dev scenario)
      // In production, this would make an actual HTTP request
      // For now, we'll skip this as we expect file mappings in dev mode

      return null;
    } catch (error) {
      console.error(`Failed to resolve control from ${url}:`, error);
      return null;
    }
  }

  /**
   * Resolve all controls in a CALM architecture
   */
  async resolveAllControls(architecture: CALMArchitecture): Promise<Map<string, ControlConfiguration>> {
    const allUrls = new Set<string>();

    // Collect all unique control URLs from nodes
    architecture.nodes?.forEach(node => {
      if (node.controls) {
        Object.values(node.controls).forEach(control => {
          control.requirements.forEach(req => {
            allUrls.add(req['config-url']);
            allUrls.add(req['requirement-url']);
          });
        });
      }
    });

    // Collect all unique control URLs from relationships
    architecture.relationships?.forEach(rel => {
      if (rel.controls) {
        Object.values(rel.controls).forEach(control => {
          control.requirements.forEach(req => {
            allUrls.add(req['config-url']);
            allUrls.add(req['requirement-url']);
          });
        });
      }
    });

    // Resolve all controls in parallel
    const resolutions = await Promise.all(
      Array.from(allUrls).map(async url => {
        const config = await this.resolveControl(url);
        return { url, config };
      })
    );

    // Build map of resolved configurations
    const resolvedMap = new Map<string, ControlConfiguration>();
    resolutions.forEach(({ url, config }) => {
      if (config) {
        resolvedMap.set(url, config);
      }
    });

    return resolvedMap;
  }

  /**
   * Get all controls with their resolved configurations
   */
  async getAllResolvedControls(architecture: CALMArchitecture): Promise<ResolvedControl[]> {
    const resolvedMap = await this.resolveAllControls(architecture);
    const results: ResolvedControl[] = [];

    // Process node controls
    architecture.nodes?.forEach(node => {
      if (node.controls) {
        Object.entries(node.controls).forEach(([controlName, control]) => {
          const configs = control.requirements
            .map(req => resolvedMap.get(req['config-url']))
            .filter((c): c is ControlConfiguration => c !== undefined);

          results.push({
            controlName,
            control,
            configs,
            sourceType: 'node',
            sourceId: node['unique-id'],
            sourceName: node.name,
          });
        });
      }
    });

    // Process relationship controls
    architecture.relationships?.forEach(rel => {
      if (rel.controls) {
        Object.entries(rel.controls).forEach(([controlName, control]) => {
          const configs = control.requirements
            .map(req => resolvedMap.get(req['config-url']))
            .filter((c): c is ControlConfiguration => c !== undefined);

          results.push({
            controlName,
            control,
            configs,
            sourceType: 'relationship',
            sourceId: rel['unique-id'],
            sourceName: rel.description || rel['unique-id'],
          });
        });
      }
    });

    return results;
  }

  /**
   * Parse URL into base and fragment
   */
  private parseUrl(url: string): { urlWithoutFragment: string; fragment?: string } {
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) {
      return { urlWithoutFragment: url };
    }
    return {
      urlWithoutFragment: url.substring(0, hashIndex),
      fragment: url.substring(hashIndex + 1),
    };
  }

  /**
   * Get mapped file path from URL
   */
  private getMappedPath(url: string): string | null {
    if (!this.fileMappings) return null;

    // Direct mapping
    if (this.fileMappings.mappings[url]) {
      return this.fileMappings.mappings[url];
    }

    // Try with trailing slash variations
    const urlWithSlash = url.endsWith('/') ? url.slice(0, -1) : url + '/';
    if (this.fileMappings.mappings[urlWithSlash]) {
      return this.fileMappings.mappings[urlWithSlash];
    }

    return null;
  }

  /**
   * Fetch control configuration from a local file
   * In a real app, this would use the file system or a bundled asset
   */
  private async fetchFromFile(filePath: string): Promise<ControlConfiguration | null> {
    try {
      // In development, we expect files to be loaded via the JSON editor
      // or bundled as assets. For now, return null and rely on the
      // file being loaded through the demo directory structure.

      // This would be implemented differently in production:
      // - Could fetch from a CDN
      // - Could be bundled with the app
      // - Could use a file input to upload the control files

      console.warn(`File-based control resolution not fully implemented for: ${filePath}`);
      return null;
    } catch (error) {
      console.error(`Failed to fetch from file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Generate cache key for a URL
   */
  private getCacheKey(url: string): string {
    return url;
  }

  /**
   * Clear the control cache
   */
  clearCache(): void {
    this.controlCache.clear();
  }
}

// Singleton instance for app-wide use
export const controlResolver = new ControlResolver();
