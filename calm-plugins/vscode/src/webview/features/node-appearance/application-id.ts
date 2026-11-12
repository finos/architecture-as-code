function isApplicationIdName(value: string): boolean {
    // CALM control identifiers appear with both hyphens and underscores in existing documents.
    return value.toLowerCase().replace(/[^a-z0-9]/g, '').includes('applicationid');
}

export function getApplicationId(data: Record<string, unknown>): string | undefined {
    const controls = data.controls as Record<string, Record<string, unknown>> | undefined;
    if (controls) {
        for (const [name, control] of Object.entries(controls)) {
            const requirements = control?.requirements as Array<Record<string, unknown>> | undefined;
            if (!requirements) continue;
            for (const requirement of requirements) {
                const url = requirement['requirement-url'] as string | undefined;
                if (!isApplicationIdName(name) && !(url && isApplicationIdName(url))) continue;
                const config = requirement.config as Record<string, unknown> | undefined;
                const value = config?.value;
                if (typeof value === 'string' && value.trim()) return value.trim();
            }
        }
    }

    const metadata = data.metadata as Record<string, unknown> | undefined;
    const value = metadata?.['application-id'] ?? metadata?.application_id;
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}