import { adrStatus } from './adr-status/adrStatus.js';
import { Decision } from './decision.js';
import { Link } from './link.js';
import { Option } from './option.js';

export interface Adr {
    title: string;
    status: adrStatus;
    creationDateTime: string;
    updateDateTime: string;
    contextAndProblemStatement: string;
    decisionDrivers: string[];
    consideredOptions: Option[];
    decisionOutcome: Decision;
    links: Link[];
}