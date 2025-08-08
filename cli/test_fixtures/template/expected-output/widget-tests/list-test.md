### Nodes (Bullet)

<ul>
        <li>
                unique-id: conference-website, node-type: webclient, name: Conference Website, description: Website to sign up for a conference, interfaces: [object Object]
        </li>
        <li>
                unique-id: load-balancer, node-type: network, name: Load Balancer, description: The attendees service, or a placeholder for another application, interfaces: [object Object]
        </li>
        <li>
                unique-id: attendees, node-type: service, name: Attendees Service, description: The attendees service, or a placeholder for another application, interfaces: [object Object],[object Object]
        </li>
        <li>
                unique-id: attendees-store, node-type: database, name: Attendees Store, description: Persistent storage for attendees, interfaces: [object Object],[object Object]
        </li>
        <li>
                unique-id: k8s-cluster, node-type: system, name: Kubernetes Cluster, description: Kubernetes Cluster with network policy rules enabled, controls: [object Object]
        </li>
</ul>


### Nodes (Ordered)

<ol>
        <li>
                unique-id: conference-website, node-type: webclient, name: Conference Website, description: Website to sign up for a conference, interfaces: [object Object]
        </li>
        <li>
                unique-id: load-balancer, node-type: network, name: Load Balancer, description: The attendees service, or a placeholder for another application, interfaces: [object Object]
        </li>
        <li>
                unique-id: attendees, node-type: service, name: Attendees Service, description: The attendees service, or a placeholder for another application, interfaces: [object Object],[object Object]
        </li>
        <li>
                unique-id: attendees-store, node-type: database, name: Attendees Store, description: Persistent storage for attendees, interfaces: [object Object],[object Object]
        </li>
        <li>
                unique-id: k8s-cluster, node-type: system, name: Kubernetes Cluster, description: Kubernetes Cluster with network policy rules enabled, controls: [object Object]
        </li>
</ol>


### Nodes With Property (Ordered)

<ol>
        <li>
                Conference Website
        </li>
        <li>
                Load Balancer
        </li>
        <li>
                Attendees Service
        </li>
        <li>
                Attendees Store
        </li>
        <li>
                Kubernetes Cluster
        </li>
</ol>