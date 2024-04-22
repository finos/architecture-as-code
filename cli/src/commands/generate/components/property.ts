export function getStringPlaceholder(name: string): string {
    return '{{ ' + name.toUpperCase().replaceAll('-', '_') + ' }}';
}

export function getPropertyValue(keyName: string, detail: any): any {
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
}