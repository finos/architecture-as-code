/**
 * File utility functions for CALM architecture files
 * These utilities are framework-agnostic and can be used across CLI, VSCode, and other consumers
 */

/** Supported architecture file extensions */
export const ARCHITECTURE_EXTENSIONS = ['.json'] as const;

/** Supported mapping file extensions */
export const MAPPING_FILE_EXTENSIONS = ['.json'] as const;

/**
 * Check if a file path has an architecture file extension (json only)
 * This is a lightweight check that only examines the file extension, not the content.
 * @param filePath - The file path to check
 * @returns true if the file has an architecture extension
 */
export function hasArchitectureExtension(filePath: string): boolean {
    return /\.json$/i.test(filePath);
}

/**
 * Check if a file path has a mapping file extension
 * @param filePath - The file path to check
 * @returns true if the file has a mapping file extension
 */
export function hasMappingFileExtension(filePath: string): boolean {
    return /\.json$/i.test(filePath);
}

/**
 * Get the file extension from a path (lowercase, with dot)
 * @param filePath - The file path
 * @returns The extension including the dot, e.g. '.json'
 */
export function getFileExtension(filePath: string): string {
    const match = filePath.match(/\.[^.]+$/);
    return match ? match[0].toLowerCase() : '';
}
