import ErrorBoundary from './ErrorBoundary';
import Lab from './lab/Lab';

const DOCS_URL = 'https://calm.finos.org';

/**
 * The same external links the docs navbar carries, opened the way Docusaurus opens external
 * links (new tab, no opener/referrer).
 */
const NAV_LINKS: ReadonlyArray<{ label: string; href: string }> = [
    { label: 'Docs', href: `${DOCS_URL}/` },
    { label: 'CALM Hub', href: 'https://hub.calm.finos.org/' },
    { label: 'GitHub', href: 'https://github.com/finos/architecture-as-code' },
];

function LabCrashed() {
    return (
        <div className="app-crash" role="alert">
            <h1>The lab hit an error</h1>
            <p>
                Your work is saved in this browser — reloading the page picks it up where you
                left off.
            </p>
            <button type="button" className="app-crash-btn" onClick={() => window.location.reload()}>
                Reload
            </button>
        </div>
    );
}

export default function App() {
    return (
        <div className="app">
            <header className="navbar" role="banner">
                <a className="navbar__brand" href={`${DOCS_URL}/`} target="_blank" rel="noopener noreferrer">
                    <picture className="navbar__logo">
                        <source srcSet="/img/2025_CALM_Icon_WHT.svg" media="(prefers-color-scheme: dark)" />
                        <img src="/img/2025_CALM_Icon.svg" alt="CALM Logo" width="32" height="32" />
                    </picture>
                    <b className="navbar__title">CALM</b>
                </a>
                <span className="navbar__subtitle">Learning Lab</span>
                <nav className="navbar__items" aria-label="Site links">
                    {NAV_LINKS.map((link) => (
                        <a
                            key={link.href}
                            className="navbar__link"
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer">
                            {link.label}
                            <svg className="navbar__external" width="13.5" height="13.5" aria-hidden="true" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M21 13v10h-21v-19h12v2h-10v15h17v-8h2zm3-12h-10.988l4.035 4-6.977 7.07 2.828 2.828 6.977-7.07 4.125 4.172v-11z" />
                            </svg>
                        </a>
                    ))}
                </nav>
            </header>
            <ErrorBoundary fallback={<LabCrashed />}>
                <Lab />
            </ErrorBoundary>
        </div>
    );
}
