import type { DiffPanelProps, DiffSectionProps } from '../model/diff-ui-types.js';
import { getRelationshipTypeDisplayString } from '../../visualizer/components/reactflow/utils/calmHelpers.js';
import '../Diff.css';

export function DiffPanel({ diffResult }: DiffPanelProps) {
    if (!diffResult) {
        return (
            <div className="diff-panel">
                <div className="diff-summary">
                    <h3 className="text-lg font-semibold mb-4">Diff Summary</h3>
                    <p className="text-gray-600">
                        Upload two CALM architecture files to see the differences.
                    </p>
                </div>
            </div>
        );
    }

    const totalChanges =
        diffResult.nodesAdded.length +
        diffResult.nodesRemoved.length +
        diffResult.nodesModified.length +
        diffResult.nodesRenamed.length +
        diffResult.edgesAdded.length +
        diffResult.edgesRemoved.length +
        diffResult.edgesModified.length +
        diffResult.edgesRenamed.length;

    return (
        <div className="diff-panel">
            <div className="diff-summary">
                <h3 className="text-lg font-semibold mb-4">Diff Summary</h3>

                <div className="diff-stats">
                    <div className="diff-stat">
                        <span className="diff-stat-number">{totalChanges}</span>
                        <span>Total Changes</span>
                    </div>
                    <div className="diff-stat">
                        <span className="diff-stat-number">
                            {diffResult.nodesAdded.length + diffResult.nodesRemoved.length +
                             diffResult.nodesModified.length + diffResult.nodesRenamed.length}
                        </span>
                        <span>Node Changes</span>
                    </div>
                    <div className="diff-stat">
                        <span className="diff-stat-number">
                            {diffResult.edgesAdded.length + diffResult.edgesRemoved.length +
                             diffResult.edgesModified.length + diffResult.edgesRenamed.length}
                        </span>
                        <span>Edge Changes</span>
                    </div>
                </div>

                <DiffSection
                    title="Nodes Added"
                    items={diffResult.nodesAdded}
                    renderItem={(node) => `${node.name || node['unique-id']} (${node['node-type']})`}
                    className="diff-item-added"
                />

                <DiffSection
                    title="Nodes Removed"
                    items={diffResult.nodesRemoved}
                    renderItem={(node) => `${node.name || node['unique-id']} (${node['node-type']})`}
                    className="diff-item-removed"
                />

                <DiffSection
                    title="Nodes Modified"
                    items={diffResult.nodesModified}
                    renderItem={(change) => `${change.original.name || change.original['unique-id']} (${change.original['node-type']})`}
                    className="diff-item-modified"
                />

                <DiffSection
                    title="Nodes Renamed"
                    items={diffResult.nodesRenamed}
                    renderItem={(rename) => `${rename.oldId} → ${rename.newId} (${rename.node['node-type']})`}
                    className="diff-item-renamed"
                />

                <DiffSection
                    title="Relationships Added"
                    items={diffResult.edgesAdded}
                    renderItem={(edge) => `${edge['unique-id']} (${getRelationshipTypeDisplayString(edge['relationship-type'])})`}
                    className="diff-item-added"
                />

                <DiffSection
                    title="Relationships Removed"
                    items={diffResult.edgesRemoved}
                    renderItem={(edge) => `${edge['unique-id']} (${getRelationshipTypeDisplayString(edge['relationship-type'])})`}
                    className="diff-item-removed"
                />

                <DiffSection
                    title="Relationships Modified"
                    items={diffResult.edgesModified}
                    renderItem={(change) => `${change.original['unique-id']} (${getRelationshipTypeDisplayString(change.original['relationship-type'])})`}
                    className="diff-item-modified"
                />

                <DiffSection
                    title="Relationships Renamed"
                    items={diffResult.edgesRenamed}
                    renderItem={(rename) => `${rename.oldId} → ${rename.newId} (${getRelationshipTypeDisplayString(rename.relationship['relationship-type'])})`}
                    className="diff-item-renamed"
                />

                {(diffResult.nodesSame.length > 0 || diffResult.edgesSame.length > 0) && (
                    <details className="diff-section">
                        <summary className="diff-section-title cursor-pointer">
                            Unchanged Items ({diffResult.nodesSame.length + diffResult.edgesSame.length})
                        </summary>
                        <DiffSection
                            title="Unchanged Nodes"
                            items={diffResult.nodesSame}
                            renderItem={(node) => `${node.name || node['unique-id']} (${node['node-type']})`}
                            className="diff-item-unchanged"
                        />
                        <DiffSection
                            title="Unchanged Relationships"
                            items={diffResult.edgesSame}
                            renderItem={(edge) => `${edge['unique-id']} (${getRelationshipTypeDisplayString(edge['relationship-type'])})`}
                            className="diff-item-unchanged"
                        />
                    </details>
                )}
            </div>
        </div>
    );
}

function DiffSection<T>({ title, items, renderItem, className }: DiffSectionProps<T>) {
    if (items.length === 0) {
        return null;
    }

    return (
        <div className="diff-section">
            <div className="diff-section-title">
                {title} ({items.length})
            </div>
            <div>
                {items.map((item, index) => (
                    <div key={index} className={`diff-item ${className}`}>
                        {renderItem(item)}
                    </div>
                ))}
            </div>
        </div>
    );
}
