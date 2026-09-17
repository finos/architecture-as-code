import { ControlDoc, JsonSchemaProperty } from '../../../model/control.js';
import { DocHeader } from './DocHeader.js';
import { ReadableField } from './ReadableField.js';
import { ReadableJsonView } from './ReadableJsonView.js';
import { SchemaFieldList } from './SchemaFieldList.js';
import {
    HEADER_KEYS,
    SCHEMA_STRUCTURAL_KEYS,
    isJsonSchemaLike,
} from './control-doc-utils.js';

/**
 * Schema-agnostic readable renderer for a control requirement or configuration
 * document. Lifts a header, renders a JSON-Schema-flavour body as a field list
 * and a prose / instance body as labelled rows, and falls back to a generic
 * key/value table for anything unrecognised — nothing is ever hidden.
 */
export function ReadableControlDoc({ doc }: { doc?: ControlDoc }) {
    if (!doc || typeof doc !== 'object') {
        return (
            <div className="text-center w-full h-full p-6 text-base-content/60">
                Please select a document to load.
            </div>
        );
    }

    const record = doc as Record<string, unknown>;

    if (Array.isArray(doc) || Object.keys(record).length === 0) {
        return <ReadableJsonView json={record} />;
    }

    const schemaFlavour = isJsonSchemaLike(doc);
    const skip = schemaFlavour
        ? new Set([...HEADER_KEYS, ...SCHEMA_STRUCTURAL_KEYS])
        : HEADER_KEYS;
    const bodyEntries = Object.entries(record).filter(([k]) => !skip.has(k));

    return (
        <div className="flex flex-col gap-4 p-4" data-testid="readable-json-view">
            <DocHeader doc={record} />

            {schemaFlavour && (
                <SchemaFieldList
                    properties={record.properties as Record<string, JsonSchemaProperty>}
                    required={record.required as string[] | undefined}
                />
            )}

            {bodyEntries.length > 0 && (
                <div
                    className={`flex flex-col gap-3 ${schemaFlavour ? 'border-t border-base-300 pt-3' : ''}`}
                >
                    {bodyEntries.map(([k, v]) => (
                        <ReadableField key={k} name={k} value={v} />
                    ))}
                </div>
            )}
        </div>
    );
}
