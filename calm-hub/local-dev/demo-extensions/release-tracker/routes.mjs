// The routes of the release-tracker demo backend. They do no I/O, so that a test can call them.

const releases = [
    { version: '2.4.0', status: 'in-progress', date: '2026-11-06', owner: 'payments-team', element: 'order-service' },
    { version: '2.3.1', status: 'released', date: '2026-10-30', owner: 'payments-team', element: 'web-app' },
    { version: '2.3.0', status: 'rolled-back', date: '2026-10-22', owner: 'orders-team', element: 'order-service' },
    { version: '2.2.0', status: 'released', date: '2026-10-08', owner: 'platform-team', element: 'user-service' },
];
// The seeded demo architecture (calm.standalone.seed-demo-data).
const DEMO = { namespace: 'demo', type: 'architectures', id: '1', version: '1.0.0' };
const SELF = { extension: 'release-tracker', screen: 'releases' };
const tone = { released: 'positive', 'in-progress': 'info', 'rolled-back': 'negative' };
const calendar = [
    { version: '2.4.0', window: '2026-11-18 to 2026-11-20', stage: 'Full rollout', owner: 'orders-team' },
    { version: '2.5.0', window: '2026-12-02', stage: 'Review', owner: 'payments-team' },
    { version: '2.6.0', window: '2026-12-16', stage: 'Planned', owner: 'platform-team' },
];
const elements = {
    'web-app': { owner: 'web-team', lastRelease: '2.3.1', risk: 'Low', oncall: 'Priya' },
    'api-gateway': { owner: 'platform-team', lastRelease: '2.3.1', risk: 'Medium', oncall: 'Sam' },
    'user-service': { owner: 'identity-team', lastRelease: '2.2.0', risk: 'High', oncall: 'Jo' },
    'order-service': { owner: 'orders-team', lastRelease: '2.4.0 (rolling out)', risk: 'Medium', oncall: 'Alex' },
    database: { owner: 'data-team', lastRelease: '2.2.0', risk: 'Low', oncall: 'Kim' },
    'message-queue': { owner: 'platform-team', lastRelease: '2.3.0', risk: 'Low', oncall: 'Sam' },
};
// 23 deployments: 17 succeeded, 4 failed, 2 rolled back. The deployments table loads them a page at a time.
const services = ['order-service', 'web-app', 'api-gateway', 'user-service', 'database'];
const deployments = Array.from({ length: 23 }, (_, i) => ({
    id: `deploy-${String(i + 1).padStart(3, '0')}`,
    service: services[i % services.length],
    result: [2, 8, 13, 19].includes(i) ? 'failed' : [5, 16].includes(i) ? 'rolled-back' : 'succeeded',
}));
const deploymentTone = { succeeded: 'positive', failed: 'negative', 'rolled-back': 'warning' };
let reviews = 0;

const screen = (title, blocks) => ({ hubApi: 0, title, blocks });
const releaseRows = () =>
    releases.map((r) => [r.version, { badge: r.status, tone: tone[r.status] }, r.date, r.owner]);
// Each row links to the exact architecture version and the component that the release changed.
const screenRows = () =>
    releases
        .map((r) => [
            r.version,
            { badge: r.status, tone: tone[r.status] },
            r.date,
            { label: r.element, hub: { ...DEMO, element: r.element } },
            r.owner,
        ]);
const count = (list, key, value) => list.filter((item) => item[key] === value).length;
// A tile that filters the releases table: the rows whose Status cell shows the status.
const releaseTile = (label, status) => ({
    label,
    value: status ? count(releases, 'status', status) : releases.length,
    filter: status ? { table: 'releases', id: status, column: 'Status', value: status } : { table: 'releases' },
});
// A tile that filters the deployments table: Hub sends the id to the deployments route.
const deploymentTile = (label, result) => ({
    label,
    value: result ? count(deployments, 'result', result) : deployments.length,
    filter: result ? { table: 'deployments', id: result } : { table: 'deployments' },
});

function deploymentPage(q) {
    const filter = q.get('filter');
    const text = (q.get('q') ?? '').trim().toLowerCase();
    const page = Math.max(1, Number.parseInt(q.get('page') ?? '1', 10) || 1);
    const size = Math.min(100, Math.max(1, Number.parseInt(q.get('pageSize') ?? '20', 10) || 20));
    const matches = deployments.filter(
        (d) => (!filter || d.result === filter) && (!text || `${d.id} ${d.service}`.includes(text))
    );
    return {
        hubApi: 0,
        rows: matches.slice((page - 1) * size, page * size).map((d) => [d.id, d.service, { badge: d.result, tone: deploymentTone[d.result] }]),
        total: matches.length,
    };
}

export function route(method, url, body) {
    const q = url.searchParams;
    if (method === 'GET' && url.pathname === '/screen') {
        const resource = q.get('namespace') && `${q.get('namespace')} / ${q.get('resourceType')} / ${q.get('resourceId')} ${q.get('version')}`;
        return screen('Releases', [
            ...(resource ? [{ type: 'alert', tone: 'info', text: `Releases that change ${resource}.` }] : []),
            { type: 'alert', tone: 'warning', text: 'Release 2.4.0 is rolling out: order-service is at 40%.' },
            { type: 'stats', items: [
                { label: 'Releases this month', value: 3 },
                { label: 'Success rate', value: '83%' },
                { label: 'Mean lead time', value: '2.1 days' },
                { label: 'Open reviews', value: reviews },
            ] },
            { type: 'stats', items: [
                releaseTile('All releases'),
                releaseTile('In progress', 'in-progress'),
                releaseTile('Released', 'released'),
                releaseTile('Rolled back', 'rolled-back'),
            ] },
            { type: 'table', id: 'releases', columns: ['Version', 'Status', 'Date', 'Component', 'Owner'], rows: screenRows(),
                search: { label: 'Filter by version or owner', columns: ['Version', 'Owner'] } },
            { type: 'markdown', text: '### Deployments' },
            { type: 'stats', items: [
                deploymentTile('All deployments'),
                deploymentTile('Failed', 'failed'),
                deploymentTile('Rolled back', 'rolled-back'),
            ] },
            { type: 'table', id: 'deployments', columns: ['Deployment', 'Service', 'Result'], rows: [],
                search: { label: 'Filter by deployment or service' }, source: { route: 'deployments', pageSize: 5 } },
            { type: 'markdown', text: '### How releases work\nEach release goes through **review**, **canary** and **full rollout**. A rollback opens an incident automatically.' },
            { type: 'links', items: [
                { label: 'Release runbook', href: 'https://example.org/runbooks/release' },
                { label: 'Demo architecture', hub: DEMO },
                { label: 'Release view of the demo architecture', hub: { ...DEMO, extension: 'release-tracker' } },
            ] },
        ]);
    }
    if (method === 'GET' && url.pathname === '/calendar') {
        return screen('Release calendar', [
            { type: 'alert', tone: 'info', text: 'Change freeze from 2026-12-21 to 2027-01-04.' },
            { type: 'table', columns: ['Version', 'Window', 'Stage', 'Owner'],
                rows: calendar.map((r) => [r.version, r.window, r.stage, r.owner]) },
        ]);
    }
    // Hub refuses %2F in a path, so the route takes the resource as {resourceType}/{resourceId}.
    const tab = url.pathname.match(/^\/tab\/([^/]+)\/([^/]+)$/);
    if (method === 'GET' && tab) {
        const [resourceType, resourceId] = tab.slice(1).map(decodeURIComponent);
        return screen('Releases', [
            { type: 'keyValue', items: [
                { label: 'Resource', value: `${q.get('namespace') ?? '?'} / ${resourceType} / ${resourceId}` },
                { label: 'Version', value: q.get('version') ?? '?' },
                { label: 'Current release', value: '2.4.0 (rolling out)' },
                { label: 'Change freeze', value: 'None' },
                { label: 'Open reviews', value: reviews },
            ] },
            { type: 'table', columns: ['Version', 'Status', 'Date', 'Owner'], rows: releaseRows() },
            { type: 'links', items: [
                { label: 'All releases for this architecture', screen: { ...SELF, context: {
                    namespace: q.get('namespace'), type: resourceType, id: resourceId, version: q.get('version'),
                    ...(q.get('selectedElement') ? { element: q.get('selectedElement') } : {}),
                } } },
            ] },
        ]);
    }
    if (method === 'GET' && url.pathname === '/card') {
        return screen('Release health', [
            { type: 'stats', items: [
                { label: 'In flight', value: 1 },
                { label: 'Rolled back (30 days)', value: 1 },
            ] },
            { type: 'cards', items: [
                { title: '2.4.0 rolling out', subtitle: 'order-service at 40%' },
                { title: '2.3.0 rolled back', subtitle: 'orders-team, 22 Oct' },
            ] },
        ]);
    }
    if (method === 'GET' && url.pathname === '/element') {
        const id = q.get('selectedElement');
        const e = elements[id];
        if (!e) return screen('Release info', [{ type: 'alert', tone: 'neutral', text: `No release data for ${id ?? 'this element'}.` }]);
        const riskTone = { Low: 'positive', Medium: 'warning', High: 'negative' }[e.risk];
        return screen('Release info', [
            { type: 'keyValue', items: [
                { label: 'Owner', value: e.owner },
                { label: 'Last release', value: e.lastRelease },
                { label: 'On call', value: e.oncall },
            ] },
            { type: 'table', columns: ['Risk'], rows: [[{ badge: e.risk, tone: riskTone }]] },
        ]);
    }
    if (method === 'POST' && url.pathname === '/reviews') {
        reviews += 1;
        return { hubApi: 0, ok: true, review: reviews, context: body };
    }
    if (method === 'GET' && url.pathname === '/deployments') {
        return deploymentPage(q);
    }
    if (method === 'GET' && url.pathname === '/releases') {
        return { releases: releases.map(({ version, status, date }) => ({ version, status, date })) };
    }
    return null;
}
