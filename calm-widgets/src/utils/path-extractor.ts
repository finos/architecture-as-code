import * as _ from 'lodash';
import { CalmArchitecture, PathExtractionOptions } from '../types/index.js';

/**
 * Utility class for extracting data from CALM architecture using path expressions
 */
export class PathExtractor {
  /**
   * Extract data from architecture using a path expression
   * 
   * Examples:
   * - "nodes" -> all nodes
   * - "nodes[node-type==service]" -> nodes where node-type equals "service"
   * - "nodes['api-gateway'].controls" -> controls from specific node
   * - "relationships[*].metadata" -> metadata from all relationships
   * 
   * @param architecture The CALM architecture object
   * @param path The path expression to extract data
   * @param options Additional options for filtering, sorting, limiting
   */
  static extract(
    architecture: CalmArchitecture, 
    path: string, 
    options: PathExtractionOptions = {}
  ): any[] {
    try {
      const result = this.parsePath(architecture, path);
      
      // Handle null/undefined results
      if (result === null || result === undefined) {
        return [];
      }
      
      let data = Array.isArray(result) ? result : [result];

      // Apply filtering
      if (options.filter) {
        data = data.filter(item => this.matchesFilter(item, options.filter!));
      }

      // Apply sorting
      if (options.sort) {
        const sortKeys = Array.isArray(options.sort) ? options.sort : [options.sort];
        data = _.orderBy(data, sortKeys);
      }

      // Apply limit
      if (options.limit && options.limit > 0) {
        data = data.slice(0, options.limit);
      }

      return data;
    } catch (error) {
      console.warn(`Failed to extract path "${path}":`, error);
      return [];
    }
  }

  /**
   * Parse a path expression and extract the data
   */
  private static parsePath(architecture: CalmArchitecture, path: string): any {
    // Handle simple property access
    if (!path.includes('[') && !path.includes('.')) {
      return _.get(architecture, path);
    }

    // Split path into segments
    const segments = this.parsePathSegments(path);
    let current: any = architecture;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      if (segment.type === 'property') {
        current = _.get(current, segment.key!);
      } else if (segment.type === 'filter') {
        if (Array.isArray(current)) {
          current = current.filter(item => this.matchesFilter(item, segment.filter!));
        } else {
          console.warn(`Cannot apply filter to non-array value at path segment: ${segment.key}`);
          return [];
        }
      } else if (segment.type === 'index') {
        if (segment.index === '*') {
          // Wildcard - apply remaining path to each item
          if (Array.isArray(current)) {
            const remainingSegments = segments.slice(i + 1);
            if (remainingSegments.length > 0) {
              // Apply remaining path to each item
              const results = current.map(item => {
                let itemCurrent = item;
                for (const remainingSegment of remainingSegments) {
                  if (remainingSegment.type === 'property') {
                    itemCurrent = _.get(itemCurrent, remainingSegment.key!);
                  }
                  if (itemCurrent === undefined || itemCurrent === null) {
                    return null;
                  }
                }
                return itemCurrent;
              }).filter(result => result !== null);
              return results.length > 0 ? results : [];
            }
            // No remaining segments, return the array
            return current;
          } else {
            console.warn(`Cannot apply wildcard to non-array value`);
            return [];
          }
        } else {
          // Specific index or key access
          if (Array.isArray(current)) {
            // Find by unique-id if it's a string key, otherwise use as index
            if (isNaN(parseInt(segment.index!))) {
              current = current.find(item => item['unique-id'] === segment.index);
            } else {
              current = current[parseInt(segment.index!)];
            }
          } else if (typeof current === 'object' && current !== null) {
            current = current[segment.index!];
          } else {
            console.warn(`Cannot index non-array/object value: ${segment.index}`);
            return null;
          }
        }
      }

      if (current === undefined || current === null) {
        return segment.type === 'filter' ? [] : null;
      }
    }

    return current;
  }

  /**
   * Parse path into segments
   */
  private static parsePathSegments(path: string): PathSegment[] {
    const segments: PathSegment[] = [];
    const parts = path.split('.');

    for (const part of parts) {
      if (part.includes('[') && part.includes(']')) {
        const [key, bracketContent] = part.split('[');
        const content = bracketContent.replace(']', '');

        // Add property segment if key exists
        if (key) {
          segments.push({ type: 'property', key });
        }

        // Parse bracket content
        if (content === '*') {
          segments.push({ type: 'index', index: '*' });
        } else if (content.includes('==')) {
          // Filter expression
          const [filterKey, filterValue] = content.split('==');
          const cleanValue = filterValue.replace(/['"]/g, '');
          segments.push({ 
            type: 'filter', 
            key: filterKey.trim(),
            filter: { [filterKey.trim()]: cleanValue }
          });
        } else {
          // Index or key access
          const cleanContent = content.replace(/['"]/g, '');
          segments.push({ type: 'index', index: cleanContent });
        }
      } else {
        segments.push({ type: 'property', key: part });
      }
    }

    return segments;
  }

  /**
   * Check if an item matches a filter
   */
  private static matchesFilter(item: any, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      const itemValue = _.get(item, key);
      if (itemValue !== value) {
        return false;
      }
    }
    return true;
  }
}

interface PathSegment {
  type: 'property' | 'filter' | 'index';
  key?: string;
  index?: string;
  filter?: Record<string, any>;
}
