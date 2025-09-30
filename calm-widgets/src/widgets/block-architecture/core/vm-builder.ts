import { CalmCoreCanonicalModel, CalmNodeCanonicalModel } from '@finos/calm-models/canonical';
import { prettyLabel } from './utils';
import { BlockArchVM, NormalizedOptions, VMContainer, VMLeafNode, VMAttach, VMEdge } from '../types';
import { buildParentHierarchy, ParentHierarchyResult } from './relationship-analyzer';
import { resolveVisibilityWithStrategies, VisibilityResult } from './visibility-resolver';
import { buildContainerForest, pruneEmptyContainers } from './builders/container-builder';
import { buildInterfaceNameMap, buildEdges } from './builders/edge-builder';

interface ContainerResult {
    containers: VMContainer[];
    attachments: VMAttach[];
    looseNodes: VMLeafNode[];
}

/**
 * Builder class for constructing Block Architecture View Models.
 * Implements the Builder pattern to provide a fluent, step-by-step construction process
 * that can be customized or tested independently.
 */
export class BlockArchVMBuilder {
    private context: CalmCoreCanonicalModel;
    private options: NormalizedOptions;
    private parentHierarchyResult?: ParentHierarchyResult;
    private visibilityResult?: VisibilityResult;
    private containerResult?: ContainerResult;
    private edges?: VMEdge[];

    constructor(context: CalmCoreCanonicalModel, options: NormalizedOptions) {
        this.context = context;
        this.options = options;
    }

    /**
     * Step 1: Analyze relationships and build parent hierarchies
     */
    analyzeRelationships(): this {
        this.parentHierarchyResult = buildParentHierarchy(this.context.relationships ?? []);
        return this;
    }

    /**
     * Step 2: Resolve visibility using the strategy chain
     */
    resolveVisibility(): this {
        if (!this.parentHierarchyResult) {
            throw new Error('Must call analyzeRelationships() first');
        }

        const nodes = this.context.nodes ?? [];
        const nodesById = new Map(nodes.map(n => [n['unique-id'], n] as const));

        this.visibilityResult = resolveVisibilityWithStrategies(
            this.context,
            this.options,
            this.parentHierarchyResult,
            nodesById
        );
        return this;
    }

    /**
     * Step 3: Build container structure
     */
    buildContainers(): this {
        if (!this.visibilityResult || !this.parentHierarchyResult) {
            throw new Error('Must call resolveVisibility() first');
        }

        const filteredNodes = this.visibilityResult.filteredNodes.slice();
        const existingIds = new Set(filteredNodes.map(n => n['unique-id']));
        for (const id of this.visibilityResult.visibleNodes) {
            if (!existingIds.has(id)) {
                const placeholder: CalmNodeCanonicalModel = {
                    'unique-id': id,
                    'node-type': 'unknown',
                    name: prettyLabel(id),
                    description: ''
                };
                filteredNodes.push(placeholder);
            }
        }

        const { containers: initialContainers, attachments, looseNodes: initialLooseNodes } = buildContainerForest(
            filteredNodes,
            this.parentHierarchyResult.parentOf,
            this.visibilityResult.containerIds,
            this.options.renderInterfaces
        );

        let looseNodes = initialLooseNodes;
        if (this.visibilityResult.containerIds.size > 0 && looseNodes.length > 0) {
            looseNodes = looseNodes.filter(n => !this.visibilityResult!.containerIds.has(n.id));
        }

        const containers = pruneEmptyContainers(initialContainers);

        this.containerResult = { containers, attachments, looseNodes };
        return this;
    }

    /**
     * Step 4: Build edges
     */
    buildEdges(): this {
        if (!this.visibilityResult) {
            throw new Error('Must call resolveVisibility() first');
        }

        const nodes = this.context.nodes ?? [];
        const nodesById = new Map(nodes.map(n => [n['unique-id'], n] as const));
        const ifaceNames = buildInterfaceNameMap(nodes);

        this.edges = this.options.edges === 'none'
            ? []
            : buildEdges(
                this.visibilityResult.filteredRels,
                this.options.renderInterfaces,
                this.options.edgeLabels,
                this.options.collapseRelationships,
                ifaceNames,
                nodesById
            );
        return this;
    }

    /**
     * Step 5: Finalize view model (sorting and other final transformations)
     */
    finalizeViewModel(): this {
        if (!this.containerResult) {
            throw new Error('Must call buildContainers() first');
        }

        // Sort all view model components alphabetically for stable, predictable layouts
        this.sortViewModel(this.containerResult.containers, this.containerResult.looseNodes);
        return this;
    }

    /**
     * Sorts all view model components alphabetically by label for stable output.
     * Recursively sorts containers and their children, and also sorts loose nodes.
     */
    private sortViewModel(containers: VMContainer[], looseNodes: VMLeafNode[]): void {
        const sortContainers = (c: VMContainer): void => {
            c.nodes.sort((a, b) => a.label.localeCompare(b.label));
            c.containers.sort((a, b) => a.label.localeCompare(b.label));
            c.containers.forEach(sortContainers);
        };

        containers.sort((a, b) => a.label.localeCompare(b.label));
        containers.forEach(sortContainers);
        looseNodes.sort((a, b) => a.label.localeCompare(b.label));
    }

    /**
     * Final step: Build the complete view model
     */
    build(): BlockArchVM {
        if (!this.containerResult || !this.edges || !this.visibilityResult) {
            throw new Error('Must complete all build steps first. Call: analyzeRelationships() -> resolveVisibility() -> buildContainers() -> buildEdges() -> finalizeViewModel()');
        }

        const highlightSet = new Set<string>(this.options.highlightNodes ?? []);
        for (const id of this.options.focusNodes ?? []) highlightSet.add(id);
        const highlightNodeIds = Array.from(highlightSet);

        return {
            containers: this.containerResult.containers,
            edges: this.edges,
            attachments: this.containerResult.attachments,
            looseNodes: this.containerResult.looseNodes,
            highlightNodeIds,
            renderNodeTypeShapes: this.options.renderNodeTypeShapes,
            linkPrefix: this.options.linkPrefix,
            linkMap: this.options.linkMap,
            nodeTypeMap: this.options.nodeTypeMap,
            warnings: this.visibilityResult.warnings,
        };
    }

    /**
     * Convenience method that executes all steps in sequence
     */
    buildComplete(): BlockArchVM {
        return this
            .analyzeRelationships()
            .resolveVisibility()
            .buildContainers()
            .buildEdges()
            .finalizeViewModel()
            .build();
    }
}

/**
 * Factory function that maintains the original API while using the builder internally
 */
export function buildBlockArchVM(
    context: CalmCoreCanonicalModel,
    opts: NormalizedOptions
): BlockArchVM {
    return new BlockArchVMBuilder(context, opts).buildComplete();
}
