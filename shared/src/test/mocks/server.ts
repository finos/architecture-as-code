import { setupServer } from 'msw/node';
import { createHandlers, HandlerConfig } from './handlers';

export const server = setupServer();

// Function to reset handlers for each test
export function resetHandlers(mocks: HandlerConfig[]) {
    server.resetHandlers(...createHandlers(mocks));
}
