import { select, input } from '@inquirer/prompts';
import {
    constructDocumentId,
    constructControlDocumentId,
    isConformantDocumentId,
    DocumentMetadata,
    ControlDocumentMetadata,
    RESOURCE_TYPES,
    ResourceType,
} from '@finos/calm-shared';
import type { CalmDocumentType } from '@finos/calm-models/types';
import { resourceTypeForDocumentType } from './document-id-type';

const DEFAULT_VERSION = '1.0.0';

type Scope = 'namespace' | 'requirement' | 'configuration';

export interface BuiltDocumentId {
    /** The constructed CalmHub `$id`. */
    id: string;
    /** Namespace component (namespace resources only; unset for control documents). */
    namespace?: string;
    /** A short slug suitable for a filename / manifest key (mapping, or control/config name). */
    slug: string;
}

export interface PromptForDocumentIdOptions {
    /** Pre-filled default for the base URL prompt (typically the configured CalmHub URL). */
    baseUrlDefault?: string;
    /** Default version (defaults to 1.0.0). */
    version?: string;
    /** The document's type. When it fixes the resource type, the scope and resource type are not asked. */
    documentType?: CalmDocumentType;
}

/** Validate a single `$id` path segment: trimmed, non-empty, no slashes. */
function segmentValidator(label: string) {
    return (value: string): true | string => {
        const v = value.trim();
        if (!v) return `${label} cannot be empty.`;
        if (v.includes('/')) return `${label} cannot contain '/'.`;
        return true;
    };
}

async function promptSegment(message: string, label: string): Promise<string> {
    const value = await input({ message, validate: segmentValidator(label) });
    return value.trim();
}

function assertConformant(id: string): void {
    if (!isConformantDocumentId(id)) {
        throw new Error(`Constructed document $id is not conformant: ${id}`);
    }
}

/**
 * Interactively build a conformant CalmHub document `$id` from its components.
 *
 * Prompts for the resource scope (namespace resource, control requirement, or control
 * configuration) and then each `$id` segment, defaulting the version to 1.0.0 and the base URL
 * to the configured CalmHub URL. A document type that fixes the resource type skips the questions
 * it answers. A type with no resource type (such as `timeline`) still gets every question, so its
 * `$id` can still name a different resource type.
 */
export async function promptForDocumentId(opts: PromptForDocumentIdOptions = {}): Promise<BuiltDocumentId> {
    const knownResourceType = opts.documentType ? resourceTypeForDocumentType(opts.documentType) : undefined;
    const controlChoices: { name: string, value: Scope }[] = [
        { name: 'Control requirement', value: 'requirement' },
        { name: 'Control configuration', value: 'configuration' },
    ];
    const scope = knownResourceType ? 'namespace' : await select<Scope>({
        message: 'What kind of CalmHub resource is this?',
        choices: opts.documentType === 'control' ? controlChoices : [
            { name: 'Namespace resource (pattern, architecture, flow, standard, interface)', value: 'namespace' },
            ...controlChoices,
        ],
    });

    const baseUrl = (await input({
        message: 'Base URL:',
        default: opts.baseUrlDefault,
        validate: (v: string) => (v && v.trim() ? true : 'Base URL cannot be empty.'),
    })).trim().replace(/\/+$/, '');

    const version = (await input({
        message: 'Version:',
        default: opts.version ?? DEFAULT_VERSION,
        validate: segmentValidator('Version'),
    })).trim();

    if (scope === 'namespace') {
        const namespace = await promptSegment('Namespace:', 'Namespace');
        const type = knownResourceType ?? await select<ResourceType>({
            message: 'Resource type:',
            choices: RESOURCE_TYPES.map((t) => ({ name: t, value: t as ResourceType })),
        });
        const mapping = await promptSegment('Mapping id:', 'Mapping id');

        const metadata: DocumentMetadata = {
            rawDocumentId: '', baseUrl, namespace, mapping, type, version, name: '',
        };
        const id = constructDocumentId(metadata);
        assertConformant(id);
        return { id, namespace, slug: mapping };
    }

    const domain = await promptSegment('Domain:', 'Domain');
    const controlName = await promptSegment('Control name:', 'Control name');
    const configName = scope === 'configuration'
        ? await promptSegment('Config name:', 'Config name')
        : undefined;

    const metadata: ControlDocumentMetadata = {
        rawDocumentId: '',
        baseUrl,
        domain,
        controlName,
        configName,
        kind: scope === 'configuration' ? 'configuration' : 'requirement',
        version,
    };
    const id = constructControlDocumentId(metadata);
    assertConformant(id);
    return { id, slug: configName ?? controlName };
}
