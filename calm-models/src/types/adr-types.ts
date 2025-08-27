//TODO: Move this to calm-widgets? This is a view model and not a CALM Type
export type CalmAdrMetaSchema = {
    namespace: string;
    id: number;
    revision: number;
    adr: CalmAdrSchema;
};

export type CalmAdrSchema = {
    title: string;
    status: CalmAdrStatus;
    creationDateTime: string;
    updateDateTime: string;
    contextAndProblemStatement: string;
    decisionDrivers: string[];
    consideredOptions: CalmAdrOptionSchema[];
    decisionOutcome: CalmAdrDecisionSchema;
    links: CalmAdrLinkSchema[];
};

export type CalmAdrStatus =
    | 'draft'
    | 'proposed'
    | 'accepted'
    | 'superseded'
    | 'rejected'
    | 'deprecated';

export type CalmAdrOptionSchema = {
    name: string;
    description: string;
    positiveConsequences: string[];
    negativeConsequences: string[];
};

export type CalmAdrDecisionSchema = {
    chosenOption: CalmAdrOptionSchema;
    rationale: string;
};

export type CalmAdrLinkSchema = {
    rel: string;
    href: string;
};
