import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Navbar } from '../components/navbar/Navbar.js';
import { useExtensions } from '../components/extensions/ExtensionsContext.js';
import { ExtensionScreen } from '../model/extensions.js';
import { ExtensionService } from '../service/extension-service.js';
import { BlockRenderer } from './blocks/BlockRenderer.js';
import { ScreenErrorBoundary } from './ScreenErrorBoundary.js';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; screen: ExtensionScreen };

export function ExtensionScreenPage({ service }: { service?: ExtensionService }) {
    const { id = '' } = useParams();
    const extension = useExtensions().find((e) => e.id === id);
    const svc = useMemo(() => service ?? new ExtensionService(), [service]);
    const [state, setState] = useState<State>({ status: 'loading' });

    useEffect(() => {
        setState({ status: 'loading' });
        svc.fetchScreen(id)
            .then((screen) => setState({ status: 'ready', screen }))
            .catch(() => setState({ status: 'error' }));
    }, [svc, id]);

    const title = (state.status === 'ready' && state.screen.title) || extension?.screen?.title || extension?.name || id;

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <Navbar />
            <main className="flex-1 overflow-auto bg-base-200">
                <div className="max-w-5xl mx-auto px-4 lg:px-6 py-5">
                    <div className="text-sm breadcrumbs py-0 text-base-content/60">
                        <ul>
                            <li><Link to="/">Hub</Link></li>
                            <li>Extensions</li>
                            <li>{title}</li>
                        </ul>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                        <h1 className="text-2xl font-bold">{title}</h1>
                        {extension?.provider && <span className="text-xs text-base-content/60">Provided by {extension.provider}</span>}
                    </div>
                    {state.status === 'loading' && (
                        <div className="flex justify-center py-12">
                            <span className="loading loading-spinner loading-lg" aria-label="Loading" />
                        </div>
                    )}
                    {state.status === 'error' && (
                        <div role="alert" className="alert alert-error alert-soft">
                            <span>This extension is not available at the moment.</span>
                        </div>
                    )}
                    {state.status === 'ready' && (
                        <ScreenErrorBoundary>
                            <div className="flex flex-col gap-4">
                                {state.screen.blocks.map((block, i) => (
                                    <BlockRenderer key={i} block={block} />
                                ))}
                            </div>
                        </ScreenErrorBoundary>
                    )}
                </div>
            </main>
        </div>
    );
}
