import { Option } from './option.js';

export interface Decision {
    chosenOption: Option;
    rationale: string;
}
