import { allExpanded, defaultStyles, JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

interface JsonRendererProps {
    json?: object;
}

function NoData() {
    return <div className=" text-center">Please select a document to load.</div>;
}

function JsonDisplay({ data }: { data: object }) {
    return <JsonView data={data} shouldExpandNode={allExpanded} style={defaultStyles} />;
}

export function JsonRenderer({ json }: JsonRendererProps) {
    const content = json ? <JsonDisplay data={json} /> : <NoData />;

    return <div>{content}</div>;
}
