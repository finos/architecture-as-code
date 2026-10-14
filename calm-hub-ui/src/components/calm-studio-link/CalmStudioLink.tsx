import { CALM_STUDIO_URL } from './calmStudioUrl.js';

interface CalmStudioLinkProps {
    className?: string;
    /** Visible label. The accessible name always says the link opens a new tab. */
    label?: string;
    onClick?: () => void;
}

/** Opens Calm Studio in a new tab. The gateway serves it at {@link CALM_STUDIO_URL}. */
export function CalmStudioLink({ className, label = 'Calm Studio', onClick }: CalmStudioLinkProps) {
    return (
        <a
            href={CALM_STUDIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
            onClick={onClick}
        >
            {label}
            <span className="sr-only"> (opens in a new tab)</span>
        </a>
    );
}
