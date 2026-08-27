import ErrorBoundary from './ErrorBoundary';
import Lab from './lab/Lab';

const DOCS_URL = 'https://calm.finos.org';

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
            <header className="app-header">
                <a className="app-brand" href={`${DOCS_URL}/`}>CALM</a>
                <span className="app-title">Learning Lab</span>
                <nav className="app-nav">
                    <a href={`${DOCS_URL}/learn/`}>Docs ↗</a>
                    <a href="https://github.com/finos/architecture-as-code">GitHub ↗</a>
                </nav>
            </header>
            <ErrorBoundary fallback={<LabCrashed />}>
                <Lab />
            </ErrorBoundary>
        </div>
    );
}
