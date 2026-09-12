import { FiExternalLink } from 'react-icons/fi';

interface ExternalLinkProps {
    href: string;
    label?: string;
}

export function ExternalLink({ href, label }: ExternalLinkProps) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="link link-hover text-info inline-flex items-center gap-1 break-all"
        >
            <FiExternalLink className="shrink-0 w-3 h-3" aria-hidden="true" />
            <span>{label ?? href}</span>
        </a>
    );
}
