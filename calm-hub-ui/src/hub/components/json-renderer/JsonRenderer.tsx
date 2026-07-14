import { Editor } from '@monaco-editor/react';
import { useResolvedTheme } from '../../../theme/useTheme.js';
import { CALM_DARK, defineCalmThemes } from '../../../theme/monaco-theme.js';

interface JsonRendererProps {
    json?: object;
    showLineNumbers?: boolean;
}

function NoData() {
    return <div className="text-center w-full h-full">Please select a document to load.</div>;
}

function JsonDisplay({ data, showLineNumbers = true }: { data: object; showLineNumbers?: boolean }) {
    // Monaco paints its own colours and ignores our stylesheet, so it needs telling
    // which theme is active — otherwise its light syntax colours land on our dark
    // surface as near-black text.
    const theme = useResolvedTheme();

    return (
        <Editor
            height="100%"
            defaultLanguage="json"
            value={JSON.stringify(data, null, 2)}
            beforeMount={defineCalmThemes}
            theme={theme === 'dark' ? CALM_DARK : 'light'}
            data-cy={"json-renderer"}
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

    return <div className="h-full" data-cy={"json-renderer-wrapper"}>{content}</div>;
}
