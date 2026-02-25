---
architecture: ../../../../../../command/generate/expected-output/conference-signup.arch.json
node-id: load-balancer
id: "load-balancer"
title: "Load Balancer"
---

# Load Balancer

## Details
<div class="table-container">
    <table>
        <tbody>
        <tr>
            <th>Unique Id</th>
            <td>load-balancer</td>
        </tr>
        <tr>
            <th>Name</th>
            <td>Load Balancer</td>
        </tr>
        <tr>
            <th>Description</th>
            <td>The attendees service, or a placeholder for another application</td>
        </tr>
        <tr>
            <th>Node Type</th>
            <td>network</td>
        </tr>
        </tbody>
    </table>
</div>

## Interfaces
<div class="table-container">
    <table>
        <thead>
        <tr>
            <th>Unique Id</th>
            <th>Host</th>
            <th>Port</th>
        </tr>
        </thead>
        <tbody>
        <tr>
            <td>load-balancer-host-port</td>
            <td>[[ HOST ]]</td>
            <td>-1</td>
        </tr>
        </tbody>
    </table>
</div>

## Related Nodes
```mermaid
graph TD;
load-balancer[load-balancer]:::highlight;
conference-website -- Connects --> load-balancer;
load-balancer -- Connects --> attendees;
load-balancer -- Deployed In --> k8s-cluster;
classDef highlight fill:#f2bbae;
```

## Controls
_No controls defined._

## Metadata
<p class="empty-message">No metadata defined.</p>
