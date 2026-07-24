/**
 * The lab's validation engine: the REAL CALM JSON Schemas — the 1.2
 * release set plus the draft/2025-03 set (imported straight from
 * calm/ in this repo) — compiled by Ajv, the same validation core the
 * CALM CLI uses, plus one semantic check the schema cannot express.
 */

import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import calmSchema from '../../../../calm/release/1.2/meta/calm.json';
import coreSchema from '../../../../calm/release/1.2/meta/core.json';
import interfaceSchema from '../../../../calm/release/1.2/meta/interface.json';
import controlSchema from '../../../../calm/release/1.2/meta/control.json';
import controlRequirementSchema from '../../../../calm/release/1.2/meta/control-requirement.json';
import evidenceSchema from '../../../../calm/release/1.2/meta/evidence.json';
import flowSchema from '../../../../calm/release/1.2/meta/flow.json';
import unitsSchema from '../../../../calm/release/1.2/meta/units.json';
import decoratorsSchema from '../../../../calm/release/1.2/meta/decorators.json';
import timelineSchema from '../../../../calm/release/1.2/meta/timeline.json';
import calmTimelineSchema from '../../../../calm/release/1.2/meta/calm-timeline.json';
import draftCalmSchema from '../../../../calm/draft/2025-03/meta/calm.json';
import draftCoreSchema from '../../../../calm/draft/2025-03/meta/core.json';
import draftInterfaceSchema from '../../../../calm/draft/2025-03/meta/interface.json';
import draftControlSchema from '../../../../calm/draft/2025-03/meta/control.json';
import draftControlRequirementSchema from '../../../../calm/draft/2025-03/meta/control-requirement.json';
import draftEvidenceSchema from '../../../../calm/draft/2025-03/meta/evidence.json';
import draftFlowSchema from '../../../../calm/draft/2025-03/meta/flow.json';
import draftUnitsSchema from '../../../../calm/draft/2025-03/meta/units.json';

const SCHEMAS = [
    calmSchema,
    coreSchema,
    interfaceSchema,
    controlSchema,
    controlRequirementSchema,
    evidenceSchema,
    flowSchema,
    unitsSchema,
    decoratorsSchema,
    timelineSchema,
    calmTimelineSchema,
    // draft/2025-03 set: documents that declare the draft $schema (e.g. the
    // TraderX sample) validate against their declared schema rather than
    // falling back to the 1.2 release.
    draftCalmSchema,
    draftCoreSchema,
    draftInterfaceSchema,
    draftControlSchema,
    draftControlRequirementSchema,
    draftEvidenceSchema,
    draftFlowSchema,
    draftUnitsSchema,
];

export const DEFAULT_SCHEMA_ID = 'https://calm.finos.org/release/1.2/meta/calm.json';
const MAX_ERRORS = 20;

let ajvInstance = null;

function getAjv() {
    if (!ajvInstance) {
        ajvInstance = new Ajv2020({strict: false, allErrors: true});
        addFormats(ajvInstance);
        for (const schema of SCHEMAS) {
            ajvInstance.addSchema(schema);
        }
    }
    return ajvInstance;
}

function checkDanglingNodeRefs(doc, push) {
    const nodes = Array.isArray(doc?.nodes) ? doc.nodes : [];
    const nodeIds = new Set(
        nodes.map((node) => node?.['unique-id']).filter((id) => typeof id === 'string'),
    );
    const relationships = Array.isArray(doc?.relationships) ? doc.relationships : [];
    relationships.forEach((relationship, index) => {
        const connects = relationship?.['relationship-type']?.connects;
        if (!connects || typeof connects !== 'object') {
            return;
        }
        for (const end of ['source', 'destination']) {
            const node = connects[end]?.node;
            if (typeof node === 'string' && !nodeIds.has(node)) {
                push(
                    `/relationships/${index}/relationship-type/connects/${end}/node`,
                    `'${node}' does not match the unique-id of any node in this architecture`,
                );
            }
        }
    });
}

/**
 * Validate a CALM architecture document.
 * @returns {{ok: boolean, parseError?: string, errors: {path: string, message: string}[], doc?: object}}
 */
export function validateArchitecture(jsonText) {
    let doc;
    try {
        doc = JSON.parse(jsonText);
    } catch (error) {
        return {
            ok: false,
            parseError: `This file is not valid JSON — ${error.message}`,
            errors: [],
        };
    }

    const ajv = getAjv();
    const schemaId =
        doc && typeof doc.$schema === 'string' && ajv.getSchema(doc.$schema)
            ? doc.$schema
            : DEFAULT_SCHEMA_ID;
    const validate = ajv.getSchema(schemaId);

    const errors = [];
    const seen = new Set();
    const push = (path, message) => {
        const key = `${path}|${message}`;
        if (!seen.has(key) && errors.length < MAX_ERRORS) {
            seen.add(key);
            errors.push({path, message});
        }
    };

    if (!validate(doc)) {
        for (const error of validate.errors || []) {
            push(error.instancePath || '/', error.message || 'is invalid');
        }
    }
    checkDanglingNodeRefs(doc, push);

    return {ok: errors.length === 0, errors, doc};
}
