export function getStringPlaceholder(name: string): string {
    return '{{ ' + name.toUpperCase().replaceAll('-', '_') + ' }}';
}

export function getRefPlaceholder(name: string): string {
    return '{{ REF_' + name.toUpperCase().replaceAll('-', '_') + ' }}';
}

export function getBooleanPlaceholder(name: string): string {
    return '{{ BOOLEAN_' + name.toUpperCase().replaceAll('-', '_') + ' }}';
}

interface Detail {
    const?: string | object,
    type?: 'string' | 'integer' | 'number' | 'array' | 'boolean',
    $ref?: string
}

export function getPropertyValue(keyName: string, detail: Detail): string | string[] | number | object {
    // TODO follow refs here
    // should be able to instantiate not just a simple enum type but also a whole sub-object
    // if both const and type are defined, prefer const
    if (detail.const) {
        return detail.const;
    }

    if (detail.type) {
        const propertyType = detail.type;

        if (propertyType === 'string') {
            return getStringPlaceholder(keyName);
        }
        if (propertyType === 'boolean') {
            return getBooleanPlaceholder(keyName);
        }
        if (propertyType === 'integer' || propertyType === 'number') {
            return -1;
        }
        if (propertyType === 'array') {
            return [
                getStringPlaceholder(keyName)
            ];
        }
    }

    if (detail.$ref) {
        return getRefPlaceholder(keyName);
    }
}