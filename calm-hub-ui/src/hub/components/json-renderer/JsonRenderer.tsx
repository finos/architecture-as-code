import { useNavigate } from 'react-router-dom';
import { allExpanded, defaultStyles, JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { Data } from '../../../model/calm.js';

interface JsonRendererProps {
    json?: Data;
}

function NoData() {
    return <div className=" text-center">Please select a document to load.</div>;
}

function DisplayData(json: Data) {
    return {
        name: json.name,
        data: json.data,
    };
}

function JsonDisplay({ data, handleClick }: { data: Data; handleClick: () => void }) {
    return (
        <div>
            <button
                className="bg-primary hover:bg-blue-500 text-white font-bold py-2 px-4 rounded float-right"
                onClick={handleClick}
            >
                Visualize
            </button>
            <JsonView
                data={DisplayData(data)}
                shouldExpandNode={allExpanded}
                style={defaultStyles}
            />
        </div>
    );
}

export function JsonRenderer({ json }: JsonRendererProps) {
    const navigate = useNavigate();
    function handleClick() {
        navigate('/visualizer', { state: json });
    }

    const content = json ? <JsonDisplay data={json} handleClick={handleClick} /> : <NoData />;

    return <div className="p-5 flex-1 overflow-auto bg-[#eee]">{content}</div>;
}
