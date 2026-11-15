import { useState } from 'react';
import { Link } from 'react-router-dom';
import { colors } from '../../../theme/colors.js';
import { PersonalNamespaceControl } from '../../hooks/usePersonalNamespace.js';

interface MyNamespaceCardProps {
    personalNamespace: PersonalNamespaceControl;
}

function NamespaceName({ name }: { name: string }) {
    return (
        <span data-testid="my-namespace-name" className="font-mono-jb text-[13px] break-all" style={{ color: colors.redesign.bodyStrong }}>
            {name}
        </span>
    );
}

function CopyNameButton({ name }: { name: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(name).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button type="button" className="btn btn-sm btn-ghost rounded-xl" onClick={copy}>
            {copied ? 'Copied' : 'Copy name'}
        </button>
    );
}

/**
 * The caller's personal namespace on the intro screen. Renders nothing when the feature is off
 * or the state is not known yet.
 */
export function MyNamespaceCard({ personalNamespace }: MyNamespaceCardProps) {
    const { state, creating, createFailed, create } = personalNamespace;
    if (state.status === 'loading' || state.status === 'unavailable') return null;

    let body: React.ReactNode;
    if (state.status === 'unsupported') {
        body = <p className="text-[13px]" style={{ color: colors.redesign.muted }}>Your user name cannot be used for a personal namespace. Ask an admin for a namespace.</p>;
    } else if (state.status === 'taken') {
        body = (
            <>
                <NamespaceName name={state.name} />
                <p className="text-[13px]" style={{ color: colors.redesign.muted }}>Another user holds this name. Ask an admin for a namespace.</p>
            </>
        );
    } else if (state.status === 'available') {
        body = (
            <>
                <NamespaceName name={state.name} />
                <p className="text-[13px]" style={{ color: colors.redesign.muted }}>
                    A private namespace for your scratch work. Only you can see it until you share it.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className="btn btn-primary btn-sm rounded-xl px-4" onClick={() => void create()} disabled={creating}>
                        {creating ? 'Creating…' : 'Create'}
                    </button>
                    {createFailed && (
                        <span role="alert" className="text-[13px] text-error">
                            Could not create the namespace. Try again.
                        </span>
                    )}
                </div>
            </>
        );
    } else {
        body = (
            <>
                <NamespaceName name={state.name} />
                <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/namespace/${encodeURIComponent(state.name)}`} className="btn btn-primary btn-sm rounded-xl px-4">
                        Open
                    </Link>
                    <CopyNameButton name={state.name} />
                </div>
            </>
        );
    }

    return (
        <section data-testid="my-namespace-card" className="w-full max-w-[640px]">
            <div className="font-mono-jb text-[11px] uppercase tracking-[0.1em] mb-3" style={{ color: colors.redesign.faintAlt }}>
                My namespace
            </div>
            <div className="flex flex-col gap-2 rounded-xl px-4 py-3" style={{ border: `1px solid ${colors.redesign.border}` }}>
                {body}
            </div>
        </section>
    );
}
