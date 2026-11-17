import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { UI_CONFIG_WAIT_MS, UiConfigProvider, useUiConfig } from './UiConfigContext.js';
import { useUiConfigStatus } from './ui-config-status.js';
import { UiConfigService } from '../../service/ui-config-service.js';

function ShowEnvironment() {
    const config = useUiConfig();
    return (
        <>
            <span>{config.environment?.name ?? 'none'}</span>
            <span data-testid="status">{useUiConfigStatus()}</span>
        </>
    );
}

function serviceReturning(result: Promise<object>): UiConfigService {
    return { getUiConfig: vi.fn(() => result) } as unknown as UiConfigService;
}

describe('UiConfigProvider', () => {
    it('provides the config from the service', async () => {
        const service = serviceReturning(Promise.resolve({ environment: { name: 'UAT', colour: 'warning' } }));

        render(<UiConfigProvider service={service}><ShowEnvironment /></UiConfigProvider>);

        expect(screen.getByTestId('status')).toHaveTextContent('loading');
        expect(await screen.findByText('UAT')).toBeInTheDocument();
        expect(screen.getByTestId('status')).toHaveTextContent('loaded');
    });

    it('provides an empty config when the service fails', async () => {
        const service = serviceReturning(Promise.reject(new Error('down')));

        render(<UiConfigProvider service={service}><ShowEnvironment /></UiConfigProvider>);

        expect(await screen.findByTestId('status')).toHaveTextContent('failed');
        expect(screen.getByText('none')).toBeInTheDocument();
        expect(service.getUiConfig).toHaveBeenCalledTimes(1);
    });

    describe('when the config request does not settle', () => {
        afterEach(() => vi.useRealTimers());

        it('continues with the defaults after the wait, and applies a reply that comes later', async () => {
            vi.useFakeTimers();
            let reply: (config: object) => void = () => {};
            const service = serviceReturning(new Promise((resolve) => (reply = resolve)));

            render(<UiConfigProvider service={service}><ShowEnvironment /></UiConfigProvider>);
            act(() => vi.advanceTimersByTime(UI_CONFIG_WAIT_MS - 1));
            expect(screen.getByTestId('status')).toHaveTextContent('loading');
            act(() => vi.advanceTimersByTime(1));
            expect(screen.getByTestId('status')).toHaveTextContent('failed');
            expect(screen.getByText('none')).toBeInTheDocument();

            await act(async () => reply({ environment: { name: 'UAT', colour: 'warning' } }));
            expect(screen.getByText('UAT')).toBeInTheDocument();
            expect(screen.getByTestId('status')).toHaveTextContent('loaded');
        });
    });
});
