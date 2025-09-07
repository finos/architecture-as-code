import { CalmCoreCanonicalModel } from '@finos/calm-models/canonical';
import { CalmWidget } from '../../types';
import { BlockArchOptions, BlockArchVM } from './types';
import { parseOptions } from './core/options-parser';
import { BlockArchVMBuilder, buildBlockArchVM } from './core/vm-builder';
import { registerGlobalTemplateHelpers } from '../../widget-helpers';

function transformToBlockArchVM(
    context: CalmCoreCanonicalModel,
    rawOptions?: BlockArchOptions
): BlockArchVM {
    const opts = parseOptions(rawOptions);
    return buildBlockArchVM(context, opts);
}

const isObj = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);

const isCalmCoreCanonicalModel = (v: unknown): v is CalmCoreCanonicalModel =>
    isObj(v) &&
    Array.isArray((v as { nodes?: unknown[] }).nodes) &&
    Array.isArray((v as { relationships?: unknown[] }).relationships);

export const BlockArchitectureWidget: CalmWidget<
    CalmCoreCanonicalModel,
    BlockArchOptions,
    BlockArchVM
> = {
    id: 'block-architecture',
    templatePartial: 'block-architecture.hbs',
    partials: ['container.hbs', 'click-links.hbs'],
    validateContext: isCalmCoreCanonicalModel,
    transformToViewModel: transformToBlockArchVM,
    registerHelpers: registerGlobalTemplateHelpers,
};

export type { BlockArchOptions, BlockArchVM } from './types';

export { transformToBlockArchVM, BlockArchVMBuilder };
