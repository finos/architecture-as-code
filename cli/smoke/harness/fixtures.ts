import { SMOKE_HUB_URL } from '../global-setup';

// JSON file helpers are shared with cli.e2e.spec.ts; re-exported here so smoke specs can keep
// importing them alongside hubDocId from a single harness module.
export { writeJson, readJson, patchJson } from '../../src/test_helpers/json-file';

/** Canonical CalmHub document $id, e.g. .../namespaces/smoke-crud/architectures/svc/versions/1.0.0 */
export function hubDocId(
    namespace: string,
    type: string,
    mapping: string,
    version: string,
    baseUrl: string = SMOKE_HUB_URL
): string {
    return `${baseUrl}/calm/namespaces/${namespace}/${type}/${mapping}/versions/${version}`;
}
