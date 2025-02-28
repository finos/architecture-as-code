import { http, HttpResponse } from 'msw'
import fs from 'fs'
import path from 'path'

// We'll export a function that creates handlers based on test needs
export const createHandlers = (mocks: {
  url: string;
  response: string | number | object | { fixture: string };
}[]) => {
  return mocks.map(mock => {
    if (typeof mock.response === 'number') {
      // Handle status code responses (e.g., 404)
      return http.get(mock.url, () => {
        return new HttpResponse(null, { status: mock.response as number })
      })
    } else if (typeof mock.response === 'string') {
      // Handle string responses
      return http.get(mock.url, () => {
        return HttpResponse.text(mock.response as string)
      })
    } else if (typeof mock.response === 'object' && mock.response !== null && 'fixture' in mock.response) {
      // Handle fixture file responses
      // Use the same path resolution approach as in the original tests
      const fixturePath = path.resolve(__dirname, '../../../test_fixtures', mock.response.fixture)
      try {
        const fixtureContent = fs.readFileSync(fixturePath, 'utf8')
        
        return http.get(mock.url, () => {
          return HttpResponse.text(fixtureContent, {
            headers: {
              'Content-Type': 'application/json'
            }
          })
        })
      } catch (error) {
        console.error(`Error reading fixture file: ${fixturePath}`, error)
        throw error
      }
    } else {
      // Handle JSON responses
      return http.get(mock.url, () => {
        return HttpResponse.json(mock.response)
      })
    }
  })
}
