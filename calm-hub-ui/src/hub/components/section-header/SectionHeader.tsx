import { ReactNode } from 'react';

interface SectionHeaderProps {
    icon: ReactNode;
    namespace: string;
    id: string;
    version: string;
    rightContent?: ReactNode;
}

export function SectionHeader({ icon, namespace, id, version, rightContent }: SectionHeaderProps) {
    return (
        <div className="bg-base-200 px-6 py-4 flex items-center justify-between border-b border-base-300">
            <h2 className="text-xl font-semibold flex items-center gap-2">
                {icon}
                {namespace} <span className="text-gray-400">/</span> {id}{' '}
                <span className="text-gray-400">/</span> {version}
            </h2>
            {rightContent}
        </div>
    );
}
