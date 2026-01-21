---
architecture: ../../../../../../command/generate/expected-output/conference-secure-signup-amended.arch.json
url-to-local-file-mapping: ../../../../url-mapping-secure.json
node-id: attendees-store
id: "attendees-store"
title: "Attendees Store"
---

# Attendees Store

## Details
<div class="table-container">
    <table>
        <tbody>
        <tr>
            <th>Unique Id</th>
            <td>attendees-store</td>
        </tr>
        <tr>
            <th>Name</th>
            <td>Attendees Store</td>
        </tr>
        <tr>
            <th>Description</th>
            <td>Persistent storage for attendees</td>
        </tr>
        <tr>
            <th>Node Type</th>
            <td>database</td>
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
            <td>database-image</td>
            <td></td>
            <td></td>
        </tr>
        <tr>
            <td>database-port</td>
            <td></td>
            <td>5432</td>
        </tr>
        </tbody>
    </table>
</div>

## Related Nodes
```mermaid
graph TD;
attendees-store[attendees-store]:::highlight;
attendees -- Connects --> attendees-store;
attendees-store -- Deployed In --> k8s-cluster;
classDef highlight fill:#f2bbae;
```

## Controls
_No controls defined._

## Metadata
<p class="empty-message">No metadata defined.</p>
