import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UiConfigProvider, useUiConfig } from './UiConfigContext.js';
import { UiConfigService } from '../../service/ui-config-service.js';

function ShowEnvironment() {
    const config = useUiConfig();
    return <span>{config.environment?.name ?? 'none'}</span>;
}

function serviceReturning(result: Promise<object>): UiConfigService {
    return { getUiConfig: vi.fn(() => result) } as unknown as UiConfigService;
}

describe('UiConfigProvider', () => {
    it('provides the config from the service', async () => {
        const service = serviceReturning(Promise.resolve({ environment: { name: 'UAT', colour: 'warning' } }));

        render(<UiConfigProvider service={service}><ShowEnvironment /></UiConfigProvider>);

        expect(await screen.findByText('UAT')).toBeInTheDocument();
    });

    it('provides an empty config when the service fails', async () => {
        const service = serviceReturning(Promise.reject(new Error('down')));

        render(<UiConfigProvider service={service}><ShowEnvironment /></UiConfigProvider>);

        expect(await screen.findByText('none')).toBeInTheDocument();
        expect(service.getUiConfig).toHaveBeenCalledTimes(1);
    });
});
