import { JSONPath } from 'jsonpath-plus';
import _ from 'lodash';
import { initLogger } from '../logger.js';

export interface PathExtractionOptions {
    filter?: Record<string, JsonFragment>;
    sort?: string | string[];
    limit?: number;
}

export type JsonFragment = string | number | boolean | null | JsonFragment[] | { [key: string]: JsonFragment };

/**
 * Utility class to extract data from document models using path-like expressions.
 * It translates custom dotted path syntax into JSONPath internally.
 */
export class TemplatePathExtractor {
    private static logger = initLogger(process.env.DEBUG === 'true', TemplatePathExtractor.name);

    static convertFromDotNotation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        document: any,
        path: string,
        options: PathExtractionOptions = {}
    ): JsonFragment  {
        const logger = TemplatePathExtractor.logger;

        logger.info(`Extracting path "${path}" from document with options: ${JSON.stringify(options, null, 2)}`);

        try {
            // Check if we have options that need processing
            const hasOptions = options.filter || options.sort || (options.limit && options.limit > 0);



            // Optimization: if it's a simple property name (no dots, brackets) AND no options need processing
            if (this.isSimpleProperty(path) && !hasOptions) {
                logger.info(`PATH: ${path}`);
                logger.info('Direct property access (no JSONPath needed, no options to process)');
                const result = document[path];
                return result;
            }

            // For complex paths or when options need processing, use JSONPath
            const jsonPath = this.toJsonPath(path);
            logger.info(`PATH: ${path}`);
            logger.info(`Converted to JSONPath: ${jsonPath}`);

            let result = JSONPath({
                path: jsonPath,
                json: document,
                flatten: false
            });

            logger.info(`Raw JSONPath result: ${JSON.stringify(result, null, 2)}`);

            // Ensure result is always an array for consistent processing
            result = Array.isArray(result) ? result : [result];
            logger.info(`After array normalization: ${JSON.stringify(result, null, 2)}`);

            // Handle empty results early
            if (result.length === 0) {
                logger.warn(`No results found for path: ${path} (JSONPath: ${jsonPath})`);
                return [];
            }

            // Check if the single result is itself an array - if so, we need special handling
            const shouldReturnArrayFromPath = this.shouldReturnArray(path);
            const shouldReturnArrayFromContent = result.length === 1 && Array.isArray(result[0]);

            logger.info(`shouldReturnArrayFromPath: ${shouldReturnArrayFromPath}`);
            logger.info(`shouldReturnArrayFromContent: ${shouldReturnArrayFromContent}`);

            // If we have a single result that is an array, apply options to its contents
            if (shouldReturnArrayFromContent) {
                let arrayContents = result[0];
                logger.info(`Processing array contents (length: ${arrayContents.length})`);

                // Apply filtering to array contents
                if (options.filter) {
                    logger.info(`Applying filter: ${JSON.stringify(options.filter)}`);
                    const beforeFilter = arrayContents.length;

                    // If filter is a string, parse it; otherwise, use as-is
                    const filterObj = typeof options.filter === 'string'
                        ? this.parseFilter(options.filter)
                        : options.filter;

                    arrayContents = arrayContents.filter(item => this.matchesFilter(item, filterObj!));
                    logger.info(`After filtering: ${beforeFilter} -> ${arrayContents.length} items`);
                }

                // Apply sorting to array contents
                if (options.sort) {
                    const sortKeys = Array.isArray(options.sort) ? options.sort : [options.sort];
                    logger.info(`Applying sort by: ${JSON.stringify(sortKeys)}`);
                    arrayContents = _.orderBy(arrayContents, sortKeys);
                }

                // Apply limiting to array contents
                if (options.limit && options.limit > 0) {
                    logger.info(`Applying limit: ${options.limit}`);
                    const beforeLimit = arrayContents.length;
                    arrayContents = arrayContents.slice(0, options.limit);
                    logger.info(`After limiting: ${beforeLimit} -> ${arrayContents.length} items`);
                }

                logger.info(`Final array contents result: ${JSON.stringify(arrayContents, null, 2)}`);
                return arrayContents;
            }

            // For non-array content, apply filtering, sorting, and limiting normally
            logger.info(`Processing non-array content (${result.length} items)`);

            if (options.filter) {
                logger.info(`Applying filter: ${JSON.stringify(options.filter)}`);
                const beforeFilter = result.length;
                const filterObj = typeof options.filter === 'string'
                    ? this.parseFilter(options.filter)
                    : options.filter;
                result = result.filter(item => this.matchesFilter(item, filterObj!));
                logger.info(`After filtering: ${beforeFilter} -> ${result.length} items`);
            }

            if (options.sort) {
                const sortKeys = Array.isArray(options.sort) ? options.sort : [options.sort];
                logger.info(`Applying sort by: ${JSON.stringify(sortKeys)}`);
                result = _.orderBy(result, sortKeys);
            }

            if (options.limit && options.limit > 0) {
                logger.info(`Applying limit: ${options.limit}`);
                const beforeLimit = result.length;
                result = result.slice(0, options.limit);
                logger.info(`After limiting: ${beforeLimit} -> ${result.length} items`);
            }

            // Decide whether to return single object or array based on the path type
            if (shouldReturnArrayFromPath || result.length !== 1) {
                logger.info(`Returning array result (length: ${result.length})`);
                logger.info(`Final result: ${JSON.stringify(result, null, 2)}`);
                return result;
            }

            logger.info('Returning single result');
            logger.info(`Final result: ${JSON.stringify(result[0], null, 2)}`);
            return result[0];
        } catch (err) {
            logger.warn(`Failed to extract path "${path}": ${err.message}`);
            return [];
        }
    }

    private static parseFilter(filter: string | undefined): Record<string, JsonFragment> | undefined {
        if (!filter) return undefined;
        const match = filter.match(/^([a-zA-Z0-9_-]+)==['"]([^'"]+)['"]$/);
        if (match) {
            const [, key, value] = match;
            return { [key]: value };
        }
        return undefined;
    }

    /**
     * Converts a custom dotted path with bracket filters into JSONPath syntax
     */
    private static toJsonPath(input: string): string {
        let path = input.trim();

        if (!path.startsWith('$')) {
            path = '$.' + path;
        }

        const nonFilterable = ['controls', 'metadata'];

        const quoteIfNeeded = (key: string): string => {
            // Valid JS identifier: leave as-is; otherwise, quote it
            return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : `'${key}'`;
        };

        // Convert [key=='value'] filters - always quote the key for JSONPath
        path = path.replace(
            /\[(\w[\w-]*)==['"]([^'"]+)['"]\]/g,
            (_match, key, value) => `[?(@['${key}']=='${value}')]`
        );

        // Handle bracketed lookups like nodes['id'] or nodes["id"]
        path = path.replace(
            /(\b\w+)\[['"]([^'"]+)['"]\]/g,
            (_match, parent, id) =>
                nonFilterable.includes(parent)
                    ? `${parent}['${id}']`
                    : `${parent}[?(@['unique-id']=='${id}')]`
        );

        // Ensure bracketed keys are quoted even in plain bracket usage: e.g. flows[flow-conference-signup] → flows['flow-conference-signup']
        path = path.replace(
            /\[(?!\?@)([^[\]'"]+?)\]/g,
            (_match, key) => `[${quoteIfNeeded(key)}]`
        );

        return path;
    }


    private static matchesFilter(item: JsonFragment, filter: Record<string, JsonFragment>): boolean {
        for (const [key, expected] of Object.entries(filter)) {
            const actual = _.get(item, key);
            if (Array.isArray(expected)) {
                if (!expected.includes(actual)) {
                    return false;
                }
            } else {
                if (actual !== expected) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Check if a path is a simple property name (no dots, brackets, etc.)
     */
    private static isSimpleProperty(path: string): boolean {
        return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(path.trim());
    }

    /**
     * Determine if a path should always return an array based on its structure
     */
    private static shouldReturnArray(path: string): boolean {
        // If path contains brackets but doesn't continue with a property access after the last bracket,
        // it's likely a filter or array access that should return an array
        if (path.includes('[')) {
            // Check if path ends with a property access after brackets
            const afterBrackets = path.substring(path.lastIndexOf(']') + 1);
            if (afterBrackets && afterBrackets.match(/^\.[a-zA-Z_][a-zA-Z0-9_.-]*$/)) {
                // Something comes after brackets - could be a property or collection
                // Let content-based detection decide (shouldReturnArrayFromContent)
                return false;
            }
            return true; // Ends with brackets/filters, return array
        }
        // If no brackets, let the content-based detection handle it
        return false;
    }
}