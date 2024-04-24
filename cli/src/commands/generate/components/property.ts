/* eslint-disable  @typescript-eslint/no-explicit-any */

export function getStringPlaceholder(name: string): string {
    return '{{ ' + name.toUpperCase().replaceAll('-', '_') + ' }}';
}

export function getPropertyValue(keyName: string, detail: any): any {
    // TODO follow refs here
    // should be able to instantiate not just a simple enum type but also a whole sub-object
    // if both const and type are defined, prefer const
    if ('const' in detail) {
        return detail['const'];
    }

    if ('type' in detail) {
        const propertyType = detail['type'];

        if (propertyType === 'string') {
            return getStringPlaceholder(keyName);
        }
        if (propertyType === 'integer') {
            return -1;
        }
        if (propertyType === 'array') {
            return [
                getStringPlaceholder(keyName)
            ];
        }
    }

    if ('$ref' in detail) {
        console.log('Not following $ref on property, implementation TODO');
    }
}