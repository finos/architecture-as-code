module.exports = {
    docs: [
        {
            type: 'doc',
            id: 'index',
            label: 'Home',
        },
        {
            type: 'category',
            label: 'Nodes',
            items: [
                'nodes/conference-website',
                'nodes/load-balancer',
                'nodes/attendees',
                'nodes/attendees-store',
                'nodes/k8s-cluster'
            ],
        },
        {
            type: 'category',
            label: 'Relationships',
            items: [
                'relationships/conference-website-load-balancer',
                'relationships/load-balancer-attendees-service',
                'relationships/attendees-attendees-store',
                'relationships/deployed-in-k8s-cluster'
            ],
        },
    ]
};
