import {
    User, Globe, Box, Cog, Database, Network, Users, Globe2, FileText,
    type LucideIcon,
} from 'lucide-react';

export interface AigfData {
    'risk-level'?: string;
    risks?: (string | import('../../contracts/contracts.js').RiskItem)[];
    mitigations?: (string | import('../../contracts/contracts.js').MitigationItem)[];
}

export function formatFieldName(field: string): string {
    return field.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const NODE_ICON_MAP: Record<string, LucideIcon> = {
    actor: User,
    ecosystem: Globe,
    system: Box,
    service: Cog,
    database: Database,
    datastore: Database,
    'data-store': Database,
    network: Network,
    ldap: Users,
    webclient: Globe2,
    'data-asset': FileText,
    interface: Network,
    'external-service': Globe2,
};

export function getNodeIcon(nodeType: string): LucideIcon {
    return NODE_ICON_MAP[nodeType.toLowerCase()] || Box;
}

export function extractAigf(metadata: unknown): AigfData | undefined {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
    return (metadata as Record<string, unknown>).aigf as AigfData | undefined;
}

export function getExtraProperties(data: Record<string, unknown>, knownFields: Set<string>): [string, unknown][] {
    return Object.entries(data).filter(([key]) => !knownFields.has(key));
}
