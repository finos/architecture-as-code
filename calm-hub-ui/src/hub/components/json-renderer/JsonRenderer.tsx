import { Editor } from '@monaco-editor/react';

interface JsonRendererProps {
    json?: object;
    showLineNumbers?: boolean;
}

function NoData() {
    return <div className="text-center w-full h-full">Please select a document to load.</div>;
}

function JsonDisplay({ data, showLineNumbers = true }: { data: object; showLineNumbers?: boolean }) {
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
                lineNumbers: showLineNumbers ? 'on' : 'off',
            }}
        />
    );
}

export function JsonRenderer({ json, showLineNumbers = true }: JsonRendererProps) {
    const content = json ? <JsonDisplay data={json} showLineNumbers={showLineNumbers} /> : <NoData />;

    return <div className="h-full">{content}</div>;
}
