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

/**
 * Simply return the value of the const object when instantiating a const.
 * @param detail The detail from the object to instantiate
 * @returns Either the value or the object described by the 'const' property.
 */
export function getConstValue(detail: Detail) : string | object {
    return detail.const;
}

export function getPropertyValue(keyName: string, detail: Detail): string | string[] | number | object {
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