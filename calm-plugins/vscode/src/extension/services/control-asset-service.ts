import { HubClient, HubApiError } from './hub-client';
import { buildControlCurie } from './control-curie';
import type { LocalControlDef } from './workspace-asset-service';

export interface ControlBrowseEntry {
    source: 'hub' | 'local';
    /** Hub domain name, or "Local" for locally-authored controls. */
    domain: string;
    /** Hub slug or local file stem. */
    controlName: string;
    title: string;
    description: string;
    /** Only set for local controls (their relative path). Hub refs are built after version selection. */
    requirementRef?: string;
}

export interface ControlBrowseGroup {
    domain: string;
    controls: ControlBrowseEntry[];
    /** Set when the domain fetch failed (e.g. 403 access denied). */
    error?: string;
}

/** Domain name used for the locally-authored controls group. */
export const LOCAL_DOMAIN = 'Local';

/**
 * Unified browse over local + Hub controls. Local controls are returned eagerly
 * (they are already scanned); Hub controls are fetched lazily per domain so an
 * inaccessible domain never blocks the rest of the picker.
 */
export class ControlAssetService {
    constructor(
        private hubClient: HubClient | undefined,
        private readonly getLocalControls: () => LocalControlDef[]
    ) {}

    setHubClient(client: HubClient | undefined): void {
        this.hubClient = client;
    }

    /**
     * The local controls group (fully populated) followed by one empty
     * placeholder group per available Hub domain. Hub controls are filled in
     * later via {@link browseControlsForDomain}.
     */
    async browse(): Promise<ControlBrowseGroup[]> {
        const local = this.getLocalControls();
        const groups: ControlBrowseGroup[] = [
            {
                domain: LOCAL_DOMAIN,
                controls: local.map((c) => ({
                    source: 'local',
                    domain: LOCAL_DOMAIN,
                    controlName: c.id,
                    title: c.name,
                    description: c.description,
                    requirementRef: c.domain
                        ? buildControlCurie(c.domain, c.id)
                        : c.relativePath,
                })),
            },
        ];

        if (this.hubClient) {
            try {
                const domains = await this.hubClient.getDomains();
                for (const domain of domains) {
                    groups.push({ domain, controls: [] });
                }
            } catch {
                /* Hub domains unavailable — local browse still works */
            }
        }

        return groups;
    }

    /** Fetch the controls for a single Hub domain. Returns an `error` group on 403/failure. */
    async browseControlsForDomain(domain: string): Promise<ControlBrowseGroup> {
        if (!this.hubClient) {
            return { domain, controls: [], error: 'Hub not connected' };
        }
        try {
            const controls = await this.hubClient.getControlsForDomain(domain);
            return {
                domain,
                controls: controls.map((c) => ({
                    source: 'hub',
                    domain,
                    controlName: c.name,
                    title: c.title ?? c.name,
                    description: c.description ?? '',
                })),
            };
        } catch (err) {
            return { domain, controls: [], error: describeError(err) };
        }
    }
}

function describeError(err: unknown): string {
    if (err instanceof HubApiError) {
        if (err.status === 403) return 'Access denied (403)';
        return `Failed to load controls (${err.status})`;
    }
    return err instanceof Error ? err.message : String(err);
}
