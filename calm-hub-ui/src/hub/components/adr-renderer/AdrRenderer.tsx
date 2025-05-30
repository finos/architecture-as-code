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
    adrDetails?: Adr;
}

export function AdrRenderer({ adrDetails }: AdrRendererProps) {
    const adr = adrDetails?.adr;

    const adrView = (
        <div>
            <div>
                <h1 className="font-bold inline text-4xl">{adr!.title}</h1>
                {adr!.status && <DisplayAdrStatus adrStatus={adr!.status} />}
            </div>

            <div className="mt-3 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                {styleTitle('Context and Problem')}

                <div className="collapse-content ps-0 markdownParagraphSpacing">
                    <Markdown>{adr!.contextAndProblemStatement}</Markdown>
                </div>
            </div>

            <div className="mt-2 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                {styleTitle('Decision Drivers')}

                <div className="collapse-content pt-1 pe-2">
                    {displayDecisionDrivers(adr!.decisionDrivers)}
                </div>
            </div>

            <div className="mt-2 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                {styleTitle('Considered Options')}

                <div className="collapse-content ps-0 pt-0">
                    {displayConsideredOptions(adr!.consideredOptions)}
                </div>
            </div>

            <div className="mt-2 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                {styleTitle('Decision Outcome')}

                <div className="collapse-content ps-0">
                    {displayChosenOption(adr!.decisionOutcome)}
                </div>
            </div>

            <div className="mt-2 mb-5 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                {styleTitle('Relevant Links')}

                <div className="pt-1 pe-2 collapse-content">{displayLinks(adr!.links)}</div>
            </div>

            <div className="italic  text-xs">
                <div>
                    <p className="inline"> Created on </p>
                    {getDate(adr!.creationDateTime)}
                </div>
                <div>
                    <p className="inline"> Last updated on </p>
                    {getDate(adr!.updateDateTime)}
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-5 flex-1 overflow-auto border-l-2 border-black bg-white">{adrView}</div>
    );
}
