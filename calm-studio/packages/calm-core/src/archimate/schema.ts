// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import archimateExtensionSchema from '../schemas/calm-archimate-extension.schema.json' with { type: 'json' };
import { ARCHIMATE_SCHEMA_ID } from './rules.js';

const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats.default(ajv);
ajv.addSchema(archimateExtensionSchema as object);

function getValidator(ref: string): ValidateFunction {
	const validator = ajv.getSchema(ref);
	if (!validator) {
		throw new Error(`ArchiMate schema validator not found: ${ref}`);
	}
	return validator;
}

export const validateArchimateNodeMetadata = getValidator(
	`${ARCHIMATE_SCHEMA_ID}#/defs/archimate-node-metadata`,
);

export const validateArchimateRelationshipMetadata = getValidator(
	`${ARCHIMATE_SCHEMA_ID}#/defs/archimate-relationship-metadata`,
);
