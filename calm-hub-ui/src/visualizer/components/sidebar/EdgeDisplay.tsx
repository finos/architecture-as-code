import { Edge } from '../../contracts/contracts.js';

export function EdgeDisplay({ selectedData }: { selectedData: Edge['data'] }) {
    return (
        <>
            <div className="text-xl font-bold mb-2">Edge Details</div>
            <div>
                <p>
                    <span className="font-light">unique-id: </span>
                    <span className="font-semibold">{selectedData.id}</span>
                </p>

                <p>
                    <span className="font-light">description: </span>
                    <span className="font-semibold">{selectedData.label}</span>
                </p>

                <p>
                    <span className="font-light">source: </span>
                    <span className="font-semibold">{selectedData.source}</span>
                </p>

                <p>
                    <span className="font-light">target: </span>
                    <span className="font-semibold">{selectedData.target}</span>
                </p>
            </div>
        </>
    );
}
