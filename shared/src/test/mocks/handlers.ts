import { http, HttpResponse } from 'msw';
import fs from 'fs';
import path from 'path';

// Define a reusable interface for handler configuration
export interface HandlerConfig {
    url: string;
    response: string | number | object | { fixture: string };
}

/**
 * Handle status code responses (e.g., 404)
 */
function handleMockStatusCode(url: string, status: number) {
    return http.get(url, () => {
        return new HttpResponse(null, { status });
    });
}

/**
 * Handle string responses
 */
function handleMockStringResponse(url: string, response: string) {
    return http.get(url, () => {
        return HttpResponse.text(response);
    });
}

/**
 * Handle fixture file responses
 */
function handleMockFixtureResponse(url: string, fixturePath: string) {
    // Use the same path resolution approach as in the original tests
    const resolvedPath = path.resolve(__dirname, '../../../test_fixtures', fixturePath);
    try {
        const fixtureContent = fs.readFileSync(resolvedPath, 'utf8');
        
        return http.get(url, () => {
            return HttpResponse.text(fixtureContent, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        });
    } catch (error) {
        console.error(`Error reading fixture file: ${resolvedPath}`, error);
        throw error;
    }
}

/**
 * Handle JSON responses
 */
function handleMockJsonResponse(url: string, response: object) {
    return http.get(url, () => {
        return HttpResponse.json(response);
    });
}

// We'll export a function that creates handlers based on test needs
export function createHandlers(mocks: HandlerConfig[]) {
    return mocks.map(mock => {
        if (typeof mock.response === 'number') {
            return handleMockStatusCode(mock.url, mock.response);
        } else if (typeof mock.response === 'string') {
            return handleMockStringResponse(mock.url, mock.response);
        } else if (typeof mock.response === 'object' && mock.response !== null && 'fixture' in mock.response) {
            return handleMockFixtureResponse(mock.url, mock.response.fixture);
        } else {
            return handleMockJsonResponse(mock.url, mock.response);
        }
    });
}
