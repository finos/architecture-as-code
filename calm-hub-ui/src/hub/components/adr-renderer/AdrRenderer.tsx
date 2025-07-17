import 'react-json-view-lite/dist/index.css';
import { Adr } from '../../../model/calm.js';
import Markdown from 'react-markdown';
import {
    DisplayChosenOption,
    DisplayConsideredOptions,
    DisplayDecisionDrivers,
    DisplayLinks,
    GetDate,
    StyleTitle,
    DisplayAdrStatus,
} from '../../helper-functions/adr/adr-helper-function.js';
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
                <StyleTitle title="Context and Problem" />

                <div className="collapse-content ps-0 markdownParagraphSpacing">
                    <Markdown>{adr!.contextAndProblemStatement}</Markdown>
                </div>
            </div>

            <div className="mt-2 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                <StyleTitle title="Decision Drivers" />

                <div className="collapse-content pt-1 pe-2">
                    <DisplayDecisionDrivers drivers={adr!.decisionDrivers} />
                </div>
            </div>

            <div className="mt-2 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                <StyleTitle title="Considered Options" />

                <div className="collapse-content ps-0 pt-0">
                    <DisplayConsideredOptions consideredOptions={adr!.consideredOptions} />
                </div>
            </div>

            <div className="mt-2 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                <StyleTitle title="Decision Outcome" />

                <div className="collapse-content ps-0">
                    <DisplayChosenOption decisionOutcome={adr!.decisionOutcome} />
                </div>
            </div>

            <div className="mt-2 mb-5 collapse collapse-arrow">
                <input type="checkbox" defaultChecked className="peer" />
                <StyleTitle title="Relevant Links" />

                <div className="pt-1 pe-2 collapse-content">
                    <DisplayLinks links={adr!.links} />
                </div>
            </div>

            <div className="italic  text-xs">
                <div>
                    <p className="inline"> Created on </p>
                    <GetDate date={adr!.creationDateTime} />
                </div>
                <div>
                    <p className="inline"> Last updated on </p>
                    <GetDate date={adr!.updateDateTime} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-5 flex-1 overflow-auto bg-white border-t-1 border-gray-300">
            {adrView}
        </div>
    );
}
