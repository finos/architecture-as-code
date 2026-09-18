interface FlowHeaderProps {
    description?: string;
}

/**
 * Shared description block for the flow views (sequence and architecture). The
 * flow name is not repeated here. The section breadcrumb above shows it.
 */
export function FlowHeader({ description }: FlowHeaderProps) {
    if (!description) return null;
    return (
        <div className="px-6 pt-4 pb-2">
            <p className="text-sm text-base-content/60">{description}</p>
        </div>
    );
}
