import { allExpanded, defaultStyles, JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

interface JsonRendererProps {
    jsonString: string | undefined;
}

export function JsonRenderer({ jsonString }: JsonRendererProps) {
    const defaultMessage = (
        <div className=" text-center">Please select a document to load.</div>
    );
    const jsonView = (
        <JsonView
            data={jsonString || ''}
            shouldExpandNode={allExpanded}
            style={defaultStyles}
        />
    );

    const content = jsonString ? jsonView : defaultMessage;

    return <div className="p-5 flex-1 overflow-auto bg-[#eee]">{content}</div>;
}
