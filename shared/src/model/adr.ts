import {
    CalmAdrStatus,
    CalmAdrMetaSchema,
    CalmAdrSchema,
    CalmAdrOptionSchema,
    CalmAdrDecisionSchema,
    CalmAdrLinkSchema,
} from '../types/adr-types';

export class CalmAdrMeta {
    constructor(
        public namespace: string,
        public id: number,
        public revision: number,
        public adr: CalmAdr
    ) {}

    static fromJson(calmAdrMetaSchema: CalmAdrMetaSchema): CalmAdrMeta {
        return new CalmAdrMeta(
            calmAdrMetaSchema.namespace,
            calmAdrMetaSchema.id,
            calmAdrMetaSchema.revision,
            calmAdrMetaSchema.adr
        );
    }
}

export class CalmAdr {
    constructor(
        public title: string,
        public status: CalmAdrStatus,
        public creationDateTime: string,
        public updateDateTime: string,
        public contextAndProblemStatement: string,
        public decisionDrivers: string[],
        public consideredOptions: CalmOption[],
        public decisionOutcome: CalmAdrDecision,
        public links: CalmLink[]
    ) {}

    static fromJson(calmAdrSchema: CalmAdrSchema): CalmAdr {
        return new CalmAdr(
            calmAdrSchema.title,
            calmAdrSchema.status,
            calmAdrSchema.creationDateTime,
            calmAdrSchema.updateDateTime,
            calmAdrSchema.contextAndProblemStatement,
            calmAdrSchema.decisionDrivers,
            calmAdrSchema.consideredOptions.map((option) =>
                CalmOption.fromJson(option)
            ),
            calmAdrSchema.decisionOutcome,
            calmAdrSchema.links.map((link) => CalmLink.fromJson(link))
        );
    }
}

export class CalmOption {
    constructor(
        public name: string,
        public description: string,
        public positiveConsequences: string[],
        public negativeConsequences: string[]
    ) {}

    static fromJson(optionSchema: CalmAdrOptionSchema): CalmOption {
        return new CalmOption(
            optionSchema.name,
            optionSchema.description,
            optionSchema.positiveConsequences,
            optionSchema.negativeConsequences
        );
    }
}

export class CalmAdrDecision {
    constructor(
        public chosenOption: CalmOption,
        public rationale: string
    ) {}

    static fromJson(decisionSchema: CalmAdrDecisionSchema): CalmAdrDecision {
        return new CalmAdrDecision(
            CalmOption.fromJson(decisionSchema.chosenOption),
            decisionSchema.rationale
        );
    }
}

export class CalmLink {
    constructor(
        public rel: string,
        public href: string
    ) {}

    static fromJson(linkSchema: CalmAdrLinkSchema): CalmLink {
        return new CalmLink(linkSchema.rel, linkSchema.href);
    }
}
