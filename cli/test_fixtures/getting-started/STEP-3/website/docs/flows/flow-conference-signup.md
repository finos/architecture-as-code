---
architecture: ../../../conference-signup.arch.json
url-to-local-file-mapping: ../../../../url-to-local-file-mapping.json
flow-id: flow-conference-signup
id: "flow-conference-signup"
title: "Conference Signup Flow"
---

# Conference Signup Flow

## Details
<div class="table-container">
    <table>
        <tbody>
        <tr>
            <th>Unique Id</th>
            <td>flow-conference-signup</td>
        </tr>
        <tr>
            <th>Name</th>
            <td>Conference Signup Flow</td>
        </tr>
        <tr>
            <th>Description</th>
            <td>Flow for registering a user through the conference website and storing their details in the attendee database.</td>
        </tr>
        </tbody>
    </table>
</div>

## Sequence Diagram
```mermaid
sequenceDiagram
    Conference Website ->> Load Balancer: User submits sign-up form via Conference Website to Load Balancer
    Load Balancer ->> Attendees Service: Load Balancer forwards request to Attendees Service
    Attendees Service ->> Attendees Store: Attendees Service stores attendee info in the Attendees Store
```



## Controls
_No controls defined._

## Metadata
<p class="empty-message">No metadata defined.</p>
