import 'react-json-view-lite/dist/index.css';
import { Adr } from '../../../model/calm.js';
import Markdown from 'react-markdown';
import {
    displayChosenOption,
    displayConsideredOptions,
    displayDecisionDrivers,
    displayLinks,
    getDate,
    styleTitle,
} from '../../helper-functions/adr/adr-helper-function.js';
import { DisplayAdrStatus } from '../../../model/adr/adr-status/adrStatus.js';
import './AdrRenderer.css';

interface AdrRendererProps {
    adrDetails: Adr | undefined;
}

export function AdrRenderer({ adrDetails }: AdrRendererProps) {
    const defaultMessage = <div className="text-center">Please select an ADR to load</div>;
    let adr = undefined;

    if (adrDetails !== undefined) {
        adr = adrDetails?.adr;
    }

    const adrView = (
        <div>
            <button
                className="bg-primary hover:bg-accent text-white font-bold py-2 px-4 rounded float-right"
                onClick={handleClick}
            >
                Edit ADR
            </button>

            <div>
                <h1 className="font-bold inline text-4xl">{adr && adr!.title}</h1>
                {adr && adr!.status && <DisplayAdrStatus adrStatus={adr.status} />}
            </div>

            <div className="mt-3 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                {styleTitle('Context and Problem')}

                <div className="collapse-content ps-0 markdownParagraphSpacing">
                    <Markdown>{adr && adr!.contextAndProblemStatement}</Markdown>
                </div>
            </div>

            <div className="mt-2 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                {styleTitle('Decision Drivers')}

                <div className="collapse-content pt-1 pe-2">
                    {adr && displayDecisionDrivers(adr!.decisionDrivers)}
                </div>
            </div>

            <div className="mt-2 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                {styleTitle('Considered Options')}

                <div className="collapse-content ps-0 pt-0">
                    {adr && displayConsideredOptions(adr!.consideredOptions)}
                </div>
            </div>

            <div className="mt-2 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                {styleTitle('Decision Outcome')}

                <div className="collapse-content ps-0">
                    {adr && displayChosenOption(adr!.decisionOutcome)}
                </div>
            </div>

            <div className="mt-2 mb-5 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                {styleTitle('Relevant Links')}

                <div className="pt-1 pe-2 collapse-content">{adr && displayLinks(adr!.links)}</div>
            </div>

            <div className="italic  text-xs">
                <div>
                    <p className="inline"> Created on </p>
                    {adr && getDate(adr.creationDateTime)}
                </div>
                <div>
                    <p className="inline"> Last updated on </p>
                    {adr && getDate(adr.updateDateTime)}
                </div>
            </div>
        </div>
    );

    function handleClick() {
        // edit funtionality
        console.log('editing mode');
    }

    const content = adrDetails && adrDetails.adr ? adrView : defaultMessage;

    return (
        <div className="p-5 flex-1 overflow-auto border-l-2 border-black bg-white">{content}</div>
    );
}
