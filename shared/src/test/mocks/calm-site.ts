import { readFileSync } from 'fs';
import { join } from 'path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const WORKSHOP_CONTROLS = join(__dirname, '../../../../conferences/osff-ln-2025/workshop/controls');

/**
 * Answers the requests that a test sends to calm.finos.org, so that the test needs no network access. It gives the
 * workshop control documents from this repository, and 404 for all other paths, as the site does.
 */
export function calmSite() {
    return setupServer(
        http.get('https://calm.finos.org/workshop/controls/:name', ({ params }) => {
            const name = String(params.name);
            if (!/^[\w.-]+\.json$/.test(name)) return new HttpResponse(null, { status: 404 });
            try {
                return HttpResponse.json(JSON.parse(readFileSync(join(WORKSHOP_CONTROLS, name), 'utf-8')));
            } catch {
                return new HttpResponse(null, { status: 404 });
            }
        }),
        http.get('https://calm.finos.org/*', () => new HttpResponse(null, { status: 404 }))
    );
}
