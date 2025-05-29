import { Option } from '../../../model/adr/option.js';
import { Link } from '../../../model/adr/link.js';
import Markdown from 'react-markdown';
import './adr-helper-function.css';
import { Decision } from '../../../model/adr/decision.js';

export function styleTitle(title: string) {
    return (
        <p className="pb-1 font-bold border-b text-lg text-blue-400/100 collapse-title peer-checked:text-accent m-auto p-auto ps-0 min-h-auto">
            {title}
        </p>
    );
}

export function getDate(date: string) {
    let newDate = new Date(date);

    return (
        <div className="font-bold inline">
            {newDate.getDate()} {newDate.toLocaleString('default', { month: 'short' })},{' '}
            {newDate.getFullYear()} <p className="inline font-normal">at</p> {newDate.getHours()}:
            {newDate.getMinutes()}
        </div>
    );
}
export function displayLinks(links: Link[]) {
    let returnList = [];
    for (var link of links) {
        returnList.push(
            <li key={link.rel} className="ms-3 list-row">
                <a href={link.href} rel={link.rel} target="_blank" className="underline">
                    {link.rel}
                </a>
            </li>
        );
    }
    return returnList;
}

export function displayDecisionDrivers(drivers: string[]) {
    let returnList = [];
    for (var driver of drivers) {
        returnList.push(
            <li className="ms-3" key={driver}>
                {driver}
            </li>
        );
    }
    return returnList;
}

function getListOfConsequences(consequences: string[], positive: boolean) {
    let returnList = [];
    let bulletStyling = 'ps-4 marker-negative list-none';
    if (positive) {
        bulletStyling = 'ps-4 marker-positive list-none';
    }
    for (var i = 0; i < consequences.length; i++) {
        returnList.push(
            <li key={consequences[i].valueOf()} className={bulletStyling}>
                {consequences[i].valueOf()}
            </li>
        );
    }
    return returnList;
}

export function displayConsideredOptions(consideredOptions: Option[]) {
    let returnList = [];
    for (var consideredOption of consideredOptions) {
        returnList.push(
            <div className="mt-3">
                <div className="collapse collapse-arrow border border-l-4 border-gray-300 border-l-blue-500">
                    <input type="checkbox" />
                    <div className="collapse-title font-bold">{consideredOption.name}</div>

                    <div className="collapse-content border-t border-gray-300">
                        <div className=" pt-1 pe-2 markdownParagraphSpacing">
                            <Markdown>{consideredOption.description}</Markdown>
                        </div>
                        <br></br>
                        <p className="font-bold"> Positive Consequences:</p>
                        {getListOfConsequences(consideredOption.positiveConsequences, true)}
                        <br></br>
                        <p className="font-bold"> Negative Consequences:</p>
                        {getListOfConsequences(consideredOption.negativeConsequences, false)}
                    </div>
                </div>
            </div>
        );
    }
    return returnList;
}

export function displayChosenOption(decisionOutcome: Decision) {
    return (
        <div className="pt-2">
            <p className="font-bold pb-1">{decisionOutcome.chosenOption.name}</p>

            <div className=" pt-1 pb-1 pe-2 markdownParagraphSpacing">
                <Markdown>{decisionOutcome.chosenOption.description}</Markdown>
            </div>

            <p className="font-bold"> Positive Consequences:</p>
            {getListOfConsequences(decisionOutcome.chosenOption.positiveConsequences, true)}

            <p className="font-bold mt-4"> Negative Consequences:</p>
            {getListOfConsequences(decisionOutcome.chosenOption.negativeConsequences, false)}

            <p className="font-bold mt-4"> Decision Rational:</p>
            <div className="pe-1">
                <Markdown>{decisionOutcome.rationale}</Markdown>
            </div>
        </div>
    );
}
