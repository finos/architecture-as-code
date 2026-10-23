// Made-up demo data. The architectures exist in the Hub seed data (nitrite/init-nitrite.sh).
const fluxnova = (id) => ({ namespace: 'finos.fluxnova', id, version: '1.0.0' });

export const directory = {
    people: {
        alice: { name: 'alice', team: 'payments-core', role: 'Tech lead' },
        bob: { name: 'bob', team: 'risk-engineering', role: 'Engineer' },
    },
    teams: {
        'payments-core': {
            onCall: 'bob, until Friday',
            runbook: 'https://example.com/runbooks/payments-core',
            page: 'https://example.com/teams/payments-core',
            services: [
                { name: 'settlement-engine', status: 'Healthy', owner: 'alice', architecture: fluxnova('fluxnova-settlement') },
                { name: 'kyc-onboarding', status: 'Incident', owner: 'carol', architecture: fluxnova('fluxnova-kyc-onboarding') },
                { name: 'bpm-platform', status: 'Healthy', owner: 'dan', architecture: fluxnova('fluxnova-platform') },
                { name: 'refunds-worker', status: 'Healthy', owner: 'alice' },
            ],
        },
        'risk-engineering': {
            onCall: 'erin, until Monday',
            runbook: 'https://example.com/runbooks/risk-engineering',
            page: 'https://example.com/teams/risk-engineering',
            services: [
                { name: 'flash-risk', status: 'Healthy', owner: 'bob', architecture: fluxnova('fluxnova-flash-risk') },
                { name: 'risk-ai-agent', status: 'Healthy', owner: 'erin', architecture: fluxnova('fluxnova-ai-agent') },
            ],
        },
    },
};
