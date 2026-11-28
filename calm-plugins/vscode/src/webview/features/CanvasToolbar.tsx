import React from 'react';
import { ToolbarMenu } from '../panels/ToolbarMenu';
import { getEnabledFeatureDefinitions } from './registry';
import type { CanvasFeatureId, CanvasFeatureRuntime, CanvasToolbarAction, CanvasToolbarState } from './types';

interface CanvasToolbarProps {
    enabledFeatures: ReadonlySet<CanvasFeatureId>;
    state: CanvasToolbarState;
    runtime: CanvasFeatureRuntime;
}

function isVisible(visibleWhen: CanvasToolbarAction['visibleWhen'], state: CanvasToolbarState, runtime: CanvasFeatureRuntime): boolean {
    if (visibleWhen === 'editable') return !state.readonlyMode;
    if (typeof visibleWhen === 'function') return visibleWhen(runtime);
    return true;
}

export function CanvasToolbar({ enabledFeatures, state, runtime }: CanvasToolbarProps) {
    const features = getEnabledFeatureDefinitions(enabledFeatures);
    const actions = features
        .flatMap((feature) => feature.toolbarActions ?? [])
        .filter((action) => isVisible(action.visibleWhen, state, runtime) && action.execute)
        .sort((left, right) => left.order - right.order);
    const menuActions = features
        .flatMap((feature) => feature.menuActions ?? [])
        .filter((action) => isVisible(action.visibleWhen, state, runtime) && action.execute)
        .sort((left, right) => left.order - right.order);

    return (
        <>
            {actions.map((action, index) => {
                const groupChanged = index > 0 && actions[index - 1].group !== action.group;
                const title = typeof action.title === 'function' ? action.title(runtime) : action.title;
                const label = typeof action.label === 'function' ? action.label(runtime) : action.label;
                const className = action.className ?? 'fid-toolbar-btn';

                return (
                    <React.Fragment key={action.id}>
                        {groupChanged && <span className="fid-toolbar-sep" />}
                        <button
                            onClick={() => action.execute?.(runtime)}
                            className={className}
                            disabled={action.disabledWhen?.(runtime)}
                            title={title}
                        >
                            {label}
                        </button>
                    </React.Fragment>
                );
            })}
            {menuActions.length > 0 && (
                <ToolbarMenu items={menuActions.map((action) => ({
                    id: action.id,
                    label: action.label,
                    onClick: () => action.execute?.(runtime),
                }))} />
            )}
        </>
    );
}