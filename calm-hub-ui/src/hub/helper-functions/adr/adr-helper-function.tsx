import { Option } from '../../../model/adr/option.js';
import { Link } from '../../../model/adr/link.js';
import Markdown from 'react-markdown';
import './adr-helper-function.css';
import { Decision } from '../../../model/adr/decision.js';
import { AdrStatus } from '../../../model/adr/adr-status/adrStatus.js';

export function StyleTitle(props: { title: string }) {
    return (
        <p className="pb-1 font-bold border-b text-lg text-blue-400/100 collapse-title peer-checked:text-accent m-auto p-auto ps-0 min-h-auto">
            {props.title}
        </p>
    );
}

export function GetDate(props: { date: string }) {
    const newDate = new Date(props.date);

    return (
        <div className="font-bold inline">
            {newDate.getDate()} {newDate.toLocaleString('default', { month: 'short' })},{' '}
            {newDate.getFullYear()} <p className="inline font-normal">at</p> {newDate.getHours()}:
            {newDate.getMinutes()}
        </div>
    );
}

export function DisplayLinks(props: { links: Link[] }) {
    const returnList = [];
    for (const link of props.links) {
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

export function DisplayDecisionDrivers(props: { drivers: string[] }) {
    const returnList = [];
    for (const driver of props.drivers) {
        returnList.push(
            <li className="ms-3" key={driver}>
                {driver}
            </li>
        );
    }
    return returnList;
}

function getListOfConsequences(consequences: string[], positive: boolean) {
    const returnList = [];
    let bulletStyling = 'ps-4 marker-negative list-none';
    if (positive) {
        bulletStyling = 'ps-4 marker-positive list-none';
    }
    for (let i = 0; i < consequences.length; i++) {
        returnList.push(
            <li key={consequences[i].valueOf()} className={bulletStyling}>
                {consequences[i].valueOf()}
            </li>
        );
    }
    return returnList;
}

export function DisplayConsideredOptions(props: { consideredOptions: Option[] }) {
    const returnList = [];
    for (const consideredOption of props.consideredOptions) {
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

export function DisplayChosenOption(props: { decisionOutcome: Decision }) {
    return (
        <div className="pt-2">
            <p className="font-bold pb-1">{props.decisionOutcome.chosenOption.name}</p>

            <div className=" pt-1 pb-1 pe-2 markdownParagraphSpacing">
                <Markdown>{props.decisionOutcome.chosenOption.description}</Markdown>
            </div>

            <p className="font-bold"> Positive Consequences:</p>
            {getListOfConsequences(props.decisionOutcome.chosenOption.positiveConsequences, true)}

            <p className="font-bold mt-4"> Negative Consequences:</p>
            {getListOfConsequences(props.decisionOutcome.chosenOption.negativeConsequences, false)}

            <p className="font-bold mt-4"> Decision Rational:</p>
            <div className="pe-1">
                <Markdown>{props.decisionOutcome.rationale}</Markdown>
            </div>
        </div>
    );
}

function capitaliseFirstLetter(adrStatus: string) {
    return adrStatus.charAt(0).toUpperCase() + adrStatus.slice(1);
}

export function DisplayAdrStatus(props: { adrStatus: AdrStatus }) {
    let adrStatusStyling =
        'inline rounded-full text-center text-s ps-3 pe-3 ms-3 relative bottom-1 font-bold border-solid border-2';
    const adrStatusString = capitaliseFirstLetter(props.adrStatus);

    switch (props.adrStatus) {
        case 'draft': {
            adrStatusStyling = adrStatusStyling + ' border-orange-500 text-orange-500';
            break;
        }
        case 'proposed': {
            adrStatusStyling = adrStatusStyling + ' border-teal-500 text-teal-500';
            break;
        }
        case 'accepted': {
            adrStatusStyling = adrStatusStyling + ' border-lime-500 text-lime-500';
            break;
        }
        case 'superseded': {
            adrStatusStyling = adrStatusStyling + ' border-violet-500 text-violet-500';
            break;
        }
        case 'rejected': {
            adrStatusStyling = adrStatusStyling + ' border-red-500 text-red-500';
            break;
        }
        case 'deprecated': {
            adrStatusStyling = adrStatusStyling + ' border-slate-500 text-slate-500';
        }
    }

    return <div className={adrStatusStyling}>{adrStatusString}</div>;
}
