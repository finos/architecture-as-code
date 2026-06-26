import React from 'react';
import { ControlDetail } from '../../../model/control.js';

export interface ControlItemProps {
    control: ControlDetail;
    isSelected: boolean;
    onControlClick: (control: ControlDetail) => void;
}

export function ControlItem({ control, isSelected, onControlClick }: ControlItemProps) {
    return (
        <li>
            <a className={isSelected ? 'active' : ''} onClick={() => onControlClick(control)}>
                {control.title ?? control.name}
            </a>
        </li>
    );
}
