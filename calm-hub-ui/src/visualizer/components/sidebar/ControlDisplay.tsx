import {
    CalmControlDetailSchema,
    CalmControlSchema,
} from '@finos/calm-shared/src/types/control-types.js';
import { useState } from 'react';
import { IoAddOutline, IoRemoveOutline } from 'react-icons/io5';

export function ControlDisplay({
    control,
}: {
    control: CalmControlSchema | CalmControlDetailSchema[];
}) {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleExpand = () => {
        setIsExpanded((prev) => !prev);
    };

    if (Array.isArray(control)) {
        return (
            <div className="pl-2">
                <div className="flex items-center justify-between">
                    <button
                        aria-label="toggle-array"
                        onClick={toggleExpand}
                        className="ml-auto btn btn-xs btn-outline"
                    >
                        {isExpanded ? <IoRemoveOutline size={16} /> : <IoAddOutline size={16} />}
                    </button>
                </div>
                {isExpanded && (
                    <ul className="list-disc pointer-events-none">
                        {control.map((item, index) => (
                            <li key={index} className="block">
                                {typeof item === 'object' && item !== null ? (
                                    <ul className="list-none">
                                        {Object.entries(item).map(([key, value]) => (
                                            <li key={key}>
                                                <div className="flex flex-wrap w-full">
                                                    <span className="font-light">{key}: </span>
                                                    <span className="font-semibold pl-2 break-words w-full">
                                                        {typeof value === 'object' &&
                                                        value !== null ? (
                                                            <ControlDisplay control={value} />
                                                        ) : (
                                                            String(value)
                                                        )}
                                                    </span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span className="font-semibold">{String(item)}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    } else if (typeof control === 'object' && control !== null) {
        return (
            <div className="pl-2">
                {Object.entries(control).map(([key, value]) => (
                    <div key={key} className="flex flex-wrap">
                        <div className="flex">
                            <span className="font-light">{key}: </span>
                            {typeof value !== 'object' || value === null ? (
                                <span className="font-semibold pl-2 truncate whitespace-normal">
                                    {String(value)}
                                </span>
                            ) : null}
                        </div>
                        {typeof value === 'object' && value !== null && (
                            <div className="pl-2 w-full">
                                <ControlDisplay control={value} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    }
    return <span className="truncate">{String(control)}</span>;
}
