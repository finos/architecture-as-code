import { generatePath } from 'react-router-dom';

/** The route of a versioned resource page, such as `/finos/architectures/trading/1.0.0`. */
export const RESOURCE_ROUTE = '/:namespace/:type/:id/:version';

export interface ResourceRouteParams {
    namespace: string;
    type: string;
    id: string;
    version: string;
}

/** The path of a resource page. Each part is encoded, so a value from an extension cannot add a segment. */
export const resourcePath = (params: ResourceRouteParams): string => generatePath(RESOURCE_ROUTE, { ...params });
