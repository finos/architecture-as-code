/** The id of the inspector, which its toggles control. There is one inspector on a page. */
export const INSPECTOR_ID = 'diagram-inspector';

export type InspectorTab = 'details' | 'extensions';

export const inspectorPanelId = (tab: InspectorTab) => `${INSPECTOR_ID}-panel-${tab}`;
