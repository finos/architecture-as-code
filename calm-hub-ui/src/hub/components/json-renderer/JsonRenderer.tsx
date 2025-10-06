import { Editor } from '@monaco-editor/react';

interface JsonRendererProps {
    json?: object;
}

function NoData() {
    return <div className="text-center w-full h-full">Please select a document to load.</div>;
}

function JsonDisplay({ data }: { data: object }) {
    return (
        <Editor
            height="100%"
            defaultLanguage="json"
            value={JSON.stringify(data, null, 2)}
            options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                overviewRulerLanes: 0,
                wordWrap: 'on',
            }}
        />
    );
}

export function JsonRenderer({ json }: JsonRendererProps) {
    const content = json ? <JsonDisplay data={json} /> : <NoData />;

    return <div className="h-full">{content}</div>;
}
