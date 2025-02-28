import { setupServer } from 'msw/node'
import { createHandlers } from './handlers'

// Create a server instance
export const server = setupServer()

// Function to reset handlers for each test
export const resetHandlers = (mocks: { url: string; response: string | number | object | { fixture: string } }[]) => {
  server.resetHandlers(...createHandlers(mocks))
}
