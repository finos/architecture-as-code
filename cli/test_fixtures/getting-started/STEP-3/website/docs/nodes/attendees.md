---
architecture: ../../../conference-signup.arch.json
url-to-local-file-mapping: ../../../../url-to-local-file-mapping.json
node-id: attendees
id: "attendees"
title: "Attendees Service"
---

# Attendees Service

## Details
<div class="table-container">
    <table>
        <tbody>
        <tr>
            <th>Unique Id</th>
            <td>attendees</td>
        </tr>
        <tr>
            <th>Name</th>
            <td>Attendees Service</td>
        </tr>
        <tr>
            <th>Description</th>
            <td>The attendees service, or a placeholder for another application</td>
        </tr>
        <tr>
            <th>Node Type</th>
            <td>service</td>
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
            <td>attendees-image</td>
            <td></td>
            <td></td>
        </tr>
        <tr>
            <td>attendees-port</td>
            <td></td>
            <td>-1</td>
        </tr>
        </tbody>
    </table>
</div>

## Related Nodes
```mermaid
graph TD;
attendees[attendees]:::highlight;
load-balancer -- Connects --> attendees;
attendees -- Connects --> attendees-store;
attendees -- Deployed In --> k8s-cluster;
classDef highlight fill:#f2bbae;
```

## Controls
_No controls defined._

## Metadata
<p class="empty-message">No metadata defined.</p>
