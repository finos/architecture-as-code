import { generatePath } from 'react-router-dom';

/** The route of a versioned resource page, such as `/finos/architectures/trading/1.0.0`. */
export const RESOURCE_ROUTE = '/:namespace/:type/:id/:version';

/** The route of a top-level extension screen. */
export const SCREEN_ROUTE = '/extensions/:extensionId/:contributionId';

export const SEARCH_PATH = '/search';

/** The top-level chat view (#3803). Return points name it by kind, so no link needs the path. */
export const CHAT_PATH = '/chat';

export interface ResourceRouteParams {
    namespace: string;
    type: string;
    id: string;
    version: string;
}

/** The path of a resource page. Each part is encoded, so a value from an extension cannot add a segment. */
export const resourcePath = (params: ResourceRouteParams): string => generatePath(RESOURCE_ROUTE, { ...params });

/** The path of an extension screen. Each part is encoded, as for a resource. */
export const screenRoutePath = (extensionId: string, contributionId: string): string =>
    generatePath(SCREEN_ROUTE, { extensionId, contributionId });
