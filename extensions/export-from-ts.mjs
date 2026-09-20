// SPDX-FileCopyrightText: 2026 CalmStudio contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Export TypeScript PackDefinition → JSON packs + Standard schemas at repo-root extensions/.
 * From monorepo root: npx tsx extensions/export-from-ts.mjs
 */

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initAllPacks, getAllPacks, resetRegistry } from '../calm-studio/packages/extensions/src/index.ts';
import { scaffoldNodeMetadata, scaffoldRelationshipMetadata } from '../calm-studio/packages/extensions/src/metadata/scaffoldMetadata.ts';

const here = dirname(fileURLToPath(import.meta.url));
const packsDir = join(here, 'packs');
const standardsDir = join(here, 'standards');
const schemaUri = 'https://calm.finos.org/schemas/calm-extension-pack.schema.json';
const jsonSchema2020 = 'https://json-schema.org/draft/2020-12/schema';
const CALM_12 = 'https://calm.finos.org/release/1.2/meta/calm.json';
const ARCHIMATE_STANDARD_ID =
	'https://calm.finos.org/extensions/archimate/calm-archimate-extension.schema.json';
const ARCHIMATE_SRC = join(
	here,
	'../calm-studio/packages/calm-core/src/schemas/calm-archimate-extension.schema.json',
);

const CORE_RELATIONSHIPS = [
	{
		typeId: 'connects',
		label: 'Connects',
		calmCoreVariant: 'connects',
		description: 'Directed connection from a source node to a destination node',
	},
	{
		typeId: 'composed-of',
		label: 'Composed of',
		calmCoreVariant: 'composed-of',
		description: 'Containment: container is composed of member nodes',
	},
	{
		typeId: 'deployed-in',
		label: 'Deployed in',
		calmCoreVariant: 'deployed-in',
		description: 'Deployment: nodes are deployed in a container',
	},
	{
		typeId: 'interacts',
		label: 'Interacts',
		calmCoreVariant: 'interacts',
		description: 'An actor interacts with one or more nodes',
	},
	{
		typeId: 'options',
		label: 'Options',
		calmCoreVariant: 'options',
		description: 'Choice among alternative relationship options',
	},
];

const ARCHIMATE_RELATIONSHIPS = [
	['Serving', 'interacts', 'ArchiMate Serving (CALM interacts)'],
	['Composition', 'composed-of', 'ArchiMate Composition (CALM composed-of)'],
	['Aggregation', 'composed-of', 'ArchiMate Aggregation (CALM composed-of)'],
	['Deployment', 'deployed-in', 'ArchiMate Deployment (CALM deployed-in)'],
	['Assignment', 'connects', 'ArchiMate Assignment (CALM connects)'],
	['Realization', 'connects', 'ArchiMate Realization (CALM connects)'],
	['Access', 'connects', 'ArchiMate Access (CALM connects)'],
	['Influence', 'connects', 'ArchiMate Influence (CALM connects)'],
	['Triggering', 'connects', 'ArchiMate Triggering (CALM connects)'],
	['Flow', 'connects', 'ArchiMate Flow (CALM connects)'],
	['Specialization', 'connects', 'ArchiMate Specialization (CALM connects)'],
	['Association', 'connects', 'ArchiMate Association (CALM connects)'],
].map(([name, variant, description]) => ({
	typeId: `archimate:${name}`,
	label: name,
	calmCoreVariant: variant,
	description,
}));

function standardFor(pack) {
	if (pack.id === 'core') {
		return {
			$id: CALM_12,
			$schema: jsonSchema2020,
			calmVersion: '1.2',
			status: 'published',
		};
	}
	if (pack.id === 'archimate') {
		return {
			$id: ARCHIMATE_STANDARD_ID,
			$schema: jsonSchema2020,
			href: '../standards/archimate.standard.json',
			calmVersion: '1.2',
			status: 'published',
		};
	}
	return {
		$id: `https://calm.finos.org/extensions/${pack.id}/${pack.id}.standard.json`,
		$schema: jsonSchema2020,
		href: `../standards/${pack.id}.standard.json`,
		calmVersion: '1.2',
		status: 'proposed',
	};
}

function relationshipsFor(pack) {
	return pack.id === 'archimate' ? ARCHIMATE_RELATIONSHIPS : CORE_RELATIONSHIPS;
}

function nodeEntry(node) {
	const entry = {
		typeId: node.typeId,
		label: node.label,
		icon: node.icon,
		color: node.color,
	};
	if (node.description) entry.description = node.description;
	if (node.isContainer) entry.isContainer = true;
	if (node.rectangleLayout) entry.rectangleLayout = true;
	if (node.defaultChildren?.length) entry.defaultChildren = node.defaultChildren;
	const metadata = scaffoldNodeMetadata(node.typeId);
	if (metadata) entry.defaults = { metadata };
	return entry;
}

function makeGeneratedStandard(pack, standardId) {
	const typeIds = pack.nodes.map((n) => n.typeId);
	return {
		$schema: jsonSchema2020,
		$id: standardId,
		title: `CALM ${pack.label} Extension Standard`,
		description: `CALM 1.2 overlay Standard for the ${pack.label} pack. Extends node-type with the pack's type ids. Architecture shape remains ${CALM_12}. Hosts write this $id into architecture $schema when the pack is first used, even before the URI is published on calm.finos.org.`,
		$comment:
			'Proposed until published under calm.finos.org. Load from extensions/standards/ on the filesystem.',
		$defs: {
			'node-type': {
				type: 'string',
				enum: typeIds,
				description: `${pack.label} node-type values.`,
			},
		},
	};
}

resetRegistry();
initAllPacks();
mkdirSync(packsDir, { recursive: true });
mkdirSync(standardsDir, { recursive: true });
copyFileSync(ARCHIMATE_SRC, join(standardsDir, 'archimate.standard.json'));

const catalog = {
	description:
		'Catalog of CALM extension packs at the monorepo root. Hosts load each href from the filesystem (or a bundled copy when no folder is open).',
	schema: schemaUri,
	packs: [],
};

for (const pack of getAllPacks()) {
	const standard = standardFor(pack);
	const doc = {
		$schema: schemaUri,
		$id: `https://calm.finos.org/extensions/packs/${pack.id}.extension.json`,
		id: pack.id,
		label: pack.label,
		version: pack.version,
		standard,
		color: pack.color,
		nodes: pack.nodes.map(nodeEntry),
		relationships: relationshipsFor(pack),
	};
	if (pack.id === 'archimate') {
		doc.relationshipDefaults = {
			metadata: scaffoldRelationshipMetadata(
				'archimate:applicationComponent',
				'archimate:applicationComponent',
			),
		};
	}
	const fileName = `${pack.id}.extension.json`;
	writeFileSync(join(packsDir, fileName), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

	if (pack.id !== 'core' && pack.id !== 'archimate') {
		writeFileSync(
			join(standardsDir, `${pack.id}.standard.json`),
			`${JSON.stringify(makeGeneratedStandard(pack, standard.$id), null, 2)}\n`,
			'utf8',
		);
	}

	catalog.packs.push({
		id: pack.id,
		label: pack.label,
		href: `./packs/${fileName}`,
		standard: standard.$id,
		standardHref: standard.href ? `./standards/${pack.id}.standard.json` : null,
	});
}

writeFileSync(join(here, 'index.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`Wrote ${catalog.packs.length} packs and standards to ${here}`);
