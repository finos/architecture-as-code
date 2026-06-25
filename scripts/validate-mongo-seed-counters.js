#!/usr/bin/env node

/**
 * Validates that every counter in calm-hub/mongo/init-mongo.js is seeded at or
 * above the maximum entity id of its type already present in the seed data.
 *
 * MongoCounterStore.nextValueForCounter uses findOneAndUpdate with $inc and
 * returnDocument(AFTER), so the first issued id = sequence_value + 1.  If
 * sequence_value < max seeded entity id, the first push into that namespace
 * collides with an existing seed document, producing duplicate ids in the
 * summaries API response and corrupting the UI rendering.
 *
 * architectureStoreCounter was correctly set to 2 (= max seeded architectureId)
 * from the start; this script enforces the same invariant for every type.
 */

'use strict';

const { readFileSync } = require('fs');
const { join } = require('path');

const seedPath = join(__dirname, '..', 'calm-hub', 'mongo', 'init-mongo.js');

let seed;
try {
    seed = readFileSync(seedPath, 'utf8');
} catch (err) {
    console.error(`Failed to read init-mongo.js: ${err.message}`);
    process.exit(1);
}

// Map from counter _id to its sequence_value
const counterPattern = /_id:\s*"(\w+StoreCounter)"[\s\S]*?sequence_value:\s*(\d+)/g;
const counters = new Map();
for (const m of seed.matchAll(counterPattern)) {
    counters.set(m[1], parseInt(m[2], 10));
}

// Map from entity field name to the counter that governs it
const fieldToCounter = {
    patternId: 'patternStoreCounter',
    flowId: 'flowStoreCounter',
    architectureId: 'architectureStoreCounter',
    adrId: 'adrStoreCounter',
    standardId: 'standardStoreCounter',
    interfaceId: 'interfaceStoreCounter',
    controlId: 'controlStoreCounter',
    decoratorId: 'decoratorStoreCounter',
    userAccessId: 'userAccessStoreCounter',
};

// Extract the maximum NumberInt value for each entity id field.
// Handles both unquoted JS object syntax (field: NumberInt) and quoted JSON syntax
// ("field": NumberInt) since init-mongo.js uses both styles in different sections.
function maxSeedId(field) {
    const re = new RegExp(`"?${field}"?:\\s*NumberInt\\((\\d+)\\)`, 'g');
    let max = 0;
    for (const m of seed.matchAll(re)) {
        const v = parseInt(m[1], 10);
        if (v > max) max = v;
    }
    return max;
}

let failures = 0;

for (const [field, counterName] of Object.entries(fieldToCounter)) {
    const seqVal = counters.get(counterName);
    if (seqVal === undefined) {
        console.error(`  MISSING  ${counterName} — not found in init-mongo.js`);
        failures++;
        continue;
    }
    const maxId = maxSeedId(field);
    const firstIssuedId = seqVal + 1;
    const ok = seqVal >= maxId;
    const status = ok ? 'OK     ' : 'FAIL   ';
    const detail = maxId === 0
        ? `(no seeded ${field} — first issued id would be ${firstIssuedId})`
        : `sequence_value=${seqVal}, max seeded ${field}=${maxId}, first issued id=${firstIssuedId}`;
    console.log(`  ${status}  ${counterName}: ${detail}`);
    if (!ok) failures++;
}

if (failures > 0) {
    console.error(
        `\nMongo seed counter validation FAILED (${failures} violation${failures > 1 ? 's' : ''}).\n` +
        'Each counter\'s sequence_value must be >= the max entity id already present in the seed.\n' +
        'The first id issued after init = sequence_value + 1; if that collides with a seeded id,\n' +
        'the affected namespace will contain duplicate entity ids which corrupt the Hub UI.\n\n' +
        'Fix: raise the counter sequence_value in calm-hub/mongo/init-mongo.js to match the\n' +
        'highest seeded id of that type (see architectureStoreCounter: 2 as the correct pattern).'
    );
    process.exit(1);
}

console.log(`\nMongo seed counter validation passed: ${Object.keys(fieldToCounter).length} counters checked.`);
