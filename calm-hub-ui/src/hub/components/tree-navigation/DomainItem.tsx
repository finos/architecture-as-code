import React from 'react';
import { ControlDetail } from '../../../model/control.js';
import { ControlItem } from './ControlItem.js';

export interface DomainItemProps {
    domain: string;
    isSelected: boolean;
    controls: ControlDetail[];
    selectedControlId: number | null;
    onDomainClick: (domain: string) => void;
    onControlClick: (control: ControlDetail) => void;
}

export function DomainItem({
    domain,
    isSelected,
    controls,
    selectedControlId,
    onDomainClick,
    onControlClick,
}: DomainItemProps) {
    return (
        <li>
            <details open={isSelected}>
                <summary
                    className={isSelected ? 'active' : ''}
                    onClick={(e) => {
                        e.preventDefault();
                        onDomainClick(domain);
                    }}
                >
                    {domain}
                </summary>
                {isSelected && (
                    <ul>
                        <li>
                            <details open={true}>
                                <summary className="active">Controls</summary>
                                <ul>
                                    {controls.map((control) => (
                                        <ControlItem
                                            key={control.id}
                                            control={control}
                                            isSelected={selectedControlId === control.id}
                                            onControlClick={onControlClick}
                                        />
                                    ))}
                                </ul>
                            </details>
                        </li>
                    </ul>
                )}
            </details>
        </li>
    );
}
