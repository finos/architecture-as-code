import Lab from './lab/Lab';

const DOCS_URL = 'https://calm.finos.org';

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
            <Lab />
        </div>
    );
}
