import { JsonSchemaProperty } from '../../../model/control.js';
import { RequiredBadge, ValueChip } from './MetaChip.js';
import { SchemaFieldList } from './SchemaFieldList.js';
import { formatFieldName, isPlainObject } from './control-doc-utils.js';

interface SchemaFieldProps {
    name: string;
    schema: JsonSchemaProperty;
    required?: boolean;
    /** Nesting level. Object properties recurse once (0 -> 1), then stop. */
    depth?: number;
}

function typeHint(schema: JsonSchemaProperty): string | undefined {
    if (schema.format) return schema.format;
    if (Array.isArray(schema.type)) return schema.type.join(' | ');
    return schema.type;
}

export function SchemaField({ name, schema, required, depth = 0 }: SchemaFieldProps) {
    const hint = typeHint(schema);
    const hasConst = 'const' in schema;
    const enumValues = Array.isArray(schema.enum) ? schema.enum : undefined;

    return (
        <div className="py-2 border-b border-base-300 last:border-b-0">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-base-content/80">{formatFieldName(name)}</span>
                {hint && <span className="text-xs text-base-content/50 font-mono">{hint}</span>}
                {required && <RequiredBadge />}
                {hasConst && <ValueChip>must be {String(schema.const)}</ValueChip>}
            </div>
            {schema.description && (
                <p className="text-xs text-base-content/60 mt-0.5">{schema.description}</p>
            )}
            {enumValues && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {enumValues.map((e) => (
                        <ValueChip key={String(e)}>{String(e)}</ValueChip>
                    ))}
                </div>
            )}
            {depth < 1 && isPlainObject(schema.properties) && (
                <div className="mt-1.5 ml-3 border-l border-base-300 pl-3">
                    <SchemaFieldList
                        properties={schema.properties as Record<string, JsonSchemaProperty>}
                        required={schema.required}
                        depth={depth + 1}
                    />
                </div>
            )}
        </div>
    );
}
