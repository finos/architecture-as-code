import { CSSProperties } from 'react';
import { EnvironmentColourToken, UiEnvironment } from '../../model/ui-config.js';
import { textColourFor } from './text-colour.js';

// Literal class names, because Tailwind does not find class names built at runtime.
const TOKEN_CLASSES: Record<EnvironmentColourToken, string> = {
    info: 'badge-info',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    neutral: 'badge-neutral',
};

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

export function EnvironmentPill({ environment }: { environment: UiEnvironment }) {
    const tokenClass = TOKEN_CLASSES[environment.colour as EnvironmentColourToken];
    const style: CSSProperties | undefined =
        !tokenClass && HEX_COLOUR.test(environment.colour)
            ? { backgroundColor: environment.colour, borderColor: environment.colour, color: textColourFor(environment.colour) }
            : undefined;

    return (
        <span
            className={`badge badge-sm lg:badge-md font-semibold uppercase shrink min-w-0 max-w-[4.25rem] sm:max-w-32 lg:max-w-48 ${tokenClass ?? ''}`}
            style={style}
            title={environment.name}
            data-testid="environment-pill"
        >
            <span className="truncate">{environment.name}</span>
        </span>
    );
}
