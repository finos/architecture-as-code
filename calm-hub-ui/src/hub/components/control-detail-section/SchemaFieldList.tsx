import { JsonSchemaProperty } from '../../../model/control.js';
import { SchemaField } from './SchemaField.js';

interface SchemaFieldListProps {
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
    depth?: number;
}

export function SchemaFieldList({ properties, required, depth = 0 }: SchemaFieldListProps) {
    return (
        <div className="flex flex-col">
            {Object.entries(properties).map(([name, schema]) => (
                <SchemaField
                    key={name}
                    name={name}
                    schema={schema}
                    required={required?.includes(name)}
                    depth={depth}
                />
            ))}
        </div>
    );
}
