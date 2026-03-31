import React from 'react';
import { InterfaceDetail } from '../../../model/interface.js';

export interface InterfaceItemProps {
    iface: InterfaceDetail;
    isSelected: boolean;
    onInterfaceClick: (iface: InterfaceDetail) => void;
}

export function InterfaceItem({ iface, isSelected, onInterfaceClick }: InterfaceItemProps) {
    return (
        <li>
            <a className={isSelected ? 'active' : ''} onClick={() => onInterfaceClick(iface)}>
                {iface.name}
            </a>
        </li>
    );
}
