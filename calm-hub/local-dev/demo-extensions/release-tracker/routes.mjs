// The routes of the release-tracker demo backend. They do no I/O, so that a test can call them.

const releases = [
    { version: '2.4.0', status: 'in-progress', date: '2026-11-06', owner: 'payments-team' },
    { version: '2.3.1', status: 'released', date: '2026-10-30', owner: 'payments-team' },
    { version: '2.3.0', status: 'rolled-back', date: '2026-10-22', owner: 'orders-team' },
    { version: '2.2.0', status: 'released', date: '2026-10-08', owner: 'platform-team' },
];
const tone = { released: 'positive', 'in-progress': 'info', 'rolled-back': 'negative' };
const elements = {
    'web-app': { owner: 'web-team', lastRelease: '2.3.1', risk: 'Low', oncall: 'Priya' },
    'api-gateway': { owner: 'platform-team', lastRelease: '2.3.1', risk: 'Medium', oncall: 'Sam' },
    'user-service': { owner: 'identity-team', lastRelease: '2.2.0', risk: 'High', oncall: 'Jo' },
    'order-service': { owner: 'orders-team', lastRelease: '2.4.0 (rolling out)', risk: 'Medium', oncall: 'Alex' },
    database: { owner: 'data-team', lastRelease: '2.2.0', risk: 'Low', oncall: 'Kim' },
    'message-queue': { owner: 'platform-team', lastRelease: '2.3.0', risk: 'Low', oncall: 'Sam' },
};
let reviews = 0;

const screen = (title, blocks) => ({ hubApi: 0, title, blocks });
const releaseRows = () =>
    releases.map((r) => [r.version, { badge: r.status, tone: tone[r.status] }, r.date, r.owner]);

export function route(method, url, body) {
    const q = url.searchParams;
    if (method === 'GET' && url.pathname === '/screen') {
        return screen('Releases', [
            { type: 'alert', tone: 'warning', text: 'Release 2.4.0 is rolling out: order-service is at 40%.' },
            { type: 'stats', items: [
                { label: 'Releases this month', value: 3 },
                { label: 'Success rate', value: '83%' },
                { label: 'Mean lead time', value: '2.1 days' },
                { label: 'Open reviews', value: reviews },
            ] },
            { type: 'table', columns: ['Version', 'Status', 'Date', 'Owner'], rows: releaseRows() },
            { type: 'markdown', text: '### How releases work\nEach release goes through **review**, **canary** and **full rollout**. A rollback opens an incident automatically.' },
            { type: 'links', items: [
                { label: 'Release runbook', href: 'https://example.org/runbooks/release' },
                { label: 'Demo architecture', hub: { namespace: 'demo', type: 'architectures', id: '1', version: '1.0.0' } },
            ] },
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
            ] },
            { type: 'table', columns: ['Version', 'Status', 'Date', 'Owner'], rows: releaseRows() },
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
    if (method === 'GET' && url.pathname === '/releases') {
        return { releases: releases.map(({ version, status, date }) => ({ version, status, date })) };
    }
    return null;
}
