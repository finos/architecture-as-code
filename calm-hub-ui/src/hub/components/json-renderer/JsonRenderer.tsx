import { Editor } from '@monaco-editor/react';
import './JsonRenderer.css';

interface JsonRendererProps {
    json?: object;
}

function NoData() {
    return <div className=" text-center">Please select a document to load.</div>;
}

function JsonDisplay({ data }: { data: object }) {
    return (
        <Editor
            height="100%"
            defaultLanguage="json"
            value={JSON.stringify(data, null, 2)}
            options={{ readOnly: true, minimap: { enabled: false } }}
        />
    );
}

export function JsonRenderer({ json }: JsonRendererProps) {
    const content = json ? <JsonDisplay data={json} /> : <NoData />;

    return <div className="json-renderer-container">{content}</div>;
}
