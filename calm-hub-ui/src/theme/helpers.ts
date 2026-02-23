/**
 * Helper functions for accessing theme colors
 */

import { colors } from './colors.js';

/**
 * Get the color for a specific node type
 */
export function getNodeTypeColor(nodeType: string): string {
    const type = nodeType.toLowerCase();
    return (
        colors.nodeTypes[type as keyof typeof colors.nodeTypes] ||
        colors.nodeTypes.default
    );
}

/**
 * Get the color for a risk level
 */
export function getRiskLevelColor(riskLevel: string): string {
    const level = riskLevel.toLowerCase();
    return (
        colors.risk[level as keyof typeof colors.risk] || colors.text.secondary
    );
}

/**
 * Get the color for an ADR status
 */
export function getAdrStatusColor(status: string): string {
    const normalizedStatus = status.toLowerCase();
    return (
        colors.adrStatus[normalizedStatus as keyof typeof colors.adrStatus] ||
        colors.border.dark
    );
}
